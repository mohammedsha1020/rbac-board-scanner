"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const client_1 = require("@prisma/client");
const PORT = Number(process.env.PORT) || 5000;
const HOST = '0.0.0.0';
const prisma = new client_1.PrismaClient();
async function startServer() {
    try {
        // Test DB connection
        await prisma.$connect();
        console.log('Successfully connected to Neon cloud database.');
        app_1.default.listen(PORT, HOST, () => {
            console.log(`Server is running and listening on http://${HOST}:${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to connect to the database:', error);
        process.exit(1);
    }
}
startServer();
