import log4js from "log4js";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

// 获取当前文件和目录的路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Logs {
    constructor(programName) {
        this.programName = programName;
        // 初始化日志配置
        this.init();
    }

    // 初始化日志配置
    init() {
        // 避免重复配置
        if (!this.configured) {
            log4js.configure({
                appenders: {
                    console: { type: "console" },
                    log_file: {
                        type: "file",
                        filename: `${__dirname}/logs/${this.programName}.log`,
                        maxLogSize: 20971520,
                        encoding: "utf-8",
                    },
                    data_file: {
                        type: "dateFile",
                        filename: `${__dirname}/logs/${this.programName}`,
                        alwaysIncludePattern: true,
                        pattern: "-yyyy-MM-dd-hh.log",
                        encoding: "utf-8",
                    },
                    error_file: {
                        type: "dateFile",
                        filename: `${__dirname}/logs/${this.programName}_error`,
                        alwaysIncludePattern: true,
                        pattern: "_yyyy-MM-dd.log",
                        encoding: "utf-8",
                    },
                },
                categories: {
                    default: { appenders: ["data_file"], level: "info" },
                    runMessage: { appenders: ["data_file", "console"], level: "info" },
                    warnMessage: { appenders: ["data_file", "console"], level: "warn" },
                    runError_log: { appenders: ["error_file", "console"], level: "error" },
                },
            });
            this.configured = true; // 标记已配置，避免重复配置
        }
    }

    // 获取logger实例
    getLogger(category, level) {
        let logger = log4js.getLogger(category);
        logger.level = level;
        return logger;
    }

    // 记录error日志
    error(content) {
        let logger = this.getLogger("runError_log", "error");
        logger.error(content);
    }

    // 记录warn日志
    warn(content) {
        let logger = this.getLogger("warnMessage", "warn");
        logger.warn(content);
    }

    // 记录info日志
    info(content) {
        let logger = this.getLogger("runMessage", "info");
        logger.info(content);
    }
}

// 导出单例
export default { Logs };
