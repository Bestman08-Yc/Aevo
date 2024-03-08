import axios from "axios";
import { Logs } from "./config/logs.js";
import dotenv from "dotenv";
import { ethers } from "ethers";
dotenv.config();
const MARKET_BUY = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const MARKET_SELL = "0";
const logs = new Logs("Aevo");

const parseAmount = (amount) => {
    return Math.floor(amount * 100) / 100;
};

export class Aevo {
    constructor(apiKey, api_secret, address, signing_key) {
        this.apiKey = apiKey;
        this.api_secret = api_secret;
        this.address = address;
        this.signing_key = signing_key;
        this.createAxiosInstance();
    }

    createAxiosInstance() {
        this.aevo = axios.create({
            baseURL: "https://api.aevo.xyz",
            headers: {
                "Content-Type": "application/json;",
                "AEVO-KEY": this.apiKey,
                "AEVO-SECRET": this.api_secret,
            },
        });
    }

    checkAuth = async () => {
        let res = await this.aevo.get("/auth");
        if (res.data.success != true) {
            logs.info("Authentication failed");
            return false;
        }
        return true;
    };

    getAccountDetails = async () => {
        let res = await this.aevo.get("/account");
        let balance = res.data.balance;
        let ethBalance = res.data.collaterals[0].balance;
        return balance;
    };

    getMessageSignature = async (isBuy, amount, price, timestamp, salt) => {
        const signer = new ethers.Wallet(this.signing_key);
        const orderMessage = {
            maker: this.address,
            isBuy,
            instrument: "1",
            limitPrice: price,
            amount,
            timestamp,
            salt,
        };
        const orderSignature = await signer.signTypedData(
            {
                name: "Aevo Mainnet",
                version: "1",
                chainId: 1,
            },
            {
                Order: [
                    { name: "maker", type: "address" },
                    { name: "isBuy", type: "bool" },
                    { name: "limitPrice", type: "uint256" },
                    { name: "amount", type: "uint256" },
                    { name: "salt", type: "uint256" },
                    { name: "instrument", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            },
            orderMessage
        );
        return orderSignature;
    };

    getPosions = async () => {
        let res = await this.aevo.get("/positions");
        const positions = res.data.positions;

        return res.data.positions;
    };

    order = async (size) => {
        try {
            let positions = await this.getPosions();
            let positions_size = positions.length;
            let salt = Math.floor(Math.random() * 100000).toString();
            let now = new Date();
            let timestamp = Math.floor(now.getTime() / 1000) + 0.5 * 60;

            let isBuy = positions_size > 0 ? (positions[0].side == "buy" ? false : true) : true;
            let price = positions_size > 0 ? (positions[0].side == "buy" ? MARKET_SELL : MARKET_BUY) : MARKET_BUY;
            let side = positions_size > 0 ? (positions[0].side == "buy" ? "short" : "long") : "long";
            let amount = positions_size > 0 ? ethers.parseUnits(positions[0].amount, 6).toString() : ethers.parseUnits(size, 6).toString();
            let close_position = positions_size > 0 ? true : false;
            let reduce_only = positions_size > 0 ? true : false;
            // let isBuy = positions_size > 0 ? false : true;
            // let price = positions_size > 0 ? "0" : "115792089237316195423570985008687907853269984665640564039457584007913129639935";
            // let side = positions_size > 0 ? "short" : "long";
            // let amount = ethers.parseUnits(size, 6).toString();
            let signature = await this.getMessageSignature(isBuy, amount, price, timestamp, salt);
            let data = {
                instrument: "1",
                maker: this.address,
                is_buy: isBuy,
                amount,
                limit_price: price,
                salt,
                signature,
                timestamp,
                reduce_only,
            };
            let res = await this.aevo.post("/orders", data);
            if (res.status == 200) {
                logs.info(`${side} ${size} eth,placed successfully`);
            }
            return res.data;
        } catch (error) {
            if (error.response.status == 400) {
                logs.error(error.response.data.error);
            }
        }
    };

    farmBoost = async () => {
        let res = await this.aevo.get("/farm-boost");
        logs.info(`trailing_volume: ${res.data.trailing_volume}, boosted_volume: ${res.data.boosted_volume}, farm_boost_avg: ${res.data.farm_boost_avg}`);
        // if (res.data.boosted_volume > 3000000) {
        //     logs.info("Farm Boost is over 3000000, stopping the bot");
        //     process.exit(1);
        // }
        return res.data;
    };

    cancleAllOrders = async () => {
        try {
            const data = {};
            let res = await this.aevo.delete("/orders-all");
            logs.info("All orders are canceled");
            return res.data;
        } catch (error) {
            if (error.response.status == 400) {
                return true;
            }
        }
    };
}

async function main() {
    const aevo = new Aevo(process.env.ApiKey, process.env.Api_Secret, process.env.Address, process.env.Signing_key);
    let auth = await aevo.checkAuth();
    if (!auth) {
        logs.warn("Api key is not valid");
        process.exit(1);
    }
    let currentBal = await aevo.getAccountDetails();
    logs.info(`当前磨损: ${parseAmount(currentBal)} usdc`);
    while (true) {
        try {
            await aevo.cancleAllOrders();
            await aevo.order(process.env.Size);
            let orderBal = await aevo.getAccountDetails();
            logs.info(`当前余额: ${orderBal} usdc`);
            logs.info(`当前磨损: ${parseAmount(currentBal - orderBal)} usdc`);
            currentBal = orderBal;
            await aevo.farmBoost();
            console.log(``);
            await new Promise((resolve) => setTimeout(resolve, 10));
        } catch (error) {
            if (error.response?.status == 429 && error.response.data.error == "RATE_LIMIT_EXCEEDED") {
                // logs.error("Too many requests, waiting for some seconds");
                await new Promise((resolve) => setTimeout(resolve, error.response.data.retry_after / 1000000000));
                // nanoseconds / 1000000000
            }
        }
    }
}
main();
