const TelegramBot = require('node-telegram-bot-api');
const Alpaca = require('@alpacahq/alpaca-trade-api');
require('dotenv').config();
const OpenAI = require('openai');
const puppeteer = require('puppeteer');
const webSocket = require('ws');
const alpaca = new Alpaca()


const openai = new OpenAI();

const { trade, getTradedAmountToday, canWeTrade, name } = require('./server.js')
const token = process.env.TELEGRAM_API_KEY;

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {

    bot.sendMessage(msg.chat.id, "Konichiwa Pac-chan desu!");

});

bot.on('polling_error', (error) => {
    console.log(error.code);  // => 'EFATAL'
});

bot.onText(/\/trade/, async (msg) => {
    await trade(msg, bot);
    bot.sendMessage(msg.chat.id, "Trading started!");

});

