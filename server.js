const Alpaca = require('@alpacahq/alpaca-trade-api');
require('dotenv').config();
const OpenAI = require('openai');
const puppeteer = require('puppeteer');
const webSocket = require('ws');
const openai = new OpenAI();
const alpaca = new Alpaca()


const wss = new webSocket("wss://stream.data.alpaca.markets/v1beta1/news");

let shouldWeBuy = false;    //if we have buy for value of more than 5000$ today, we should stop buy


async function trade(msg, bot) {

  const wss = new webSocket("wss://stream.data.alpaca.markets/v1beta1/news");

  let shouldWeBuy = false;    //if we have buy for value of more than 5000$ today, we should stop buy

  wss.on('open', (ws) => {
    console.log("websocktet open");

    const authMessage = {
      action: 'auth',
      key: process.env.APCA_API_KEY_ID,
      secret: process.env.APCA_API_SECRET_KEY
    }

    wss.send(JSON.stringify(authMessage));

    const subscribeMsg = {
      action: 'subscribe',
      news: ['*']
    }

    wss.send(JSON.stringify(subscribeMsg));

  })


  wss.on('message', async (message) => {

    const currentEvent = JSON.parse(message)[0]

    if (currentEvent.T != 'n') {                     //doesn't do shit, used for debugging
      bot.sendMessage(msg.chat.id, `${message}`)
      console.log("message received" + message);
    }
    

    //If we get a news
    if (currentEvent.T === 'n') {
      const stockInfo = await alpaca.getLatestTrade(currentEvent.symbols[0]);
      const stockPrice = parseFloat(stockInfo.Price);

      const news = currentEvent.content
      const cleanedNews = news.replace(/<\/?[^>]+(>|$)/g, "");

      const prompt = `\nGiven the headline '${currentEvent.headline}',
        the summary of the news as '${currentEvent.summary}', 
        the full news as "${cleanedNews}"
        and the current price of '${currentEvent.symbols[0]}' is '${stockPrice}' USD, 
        show me a number from 1-100 that shows the impact of this news on the company where 1 is the worst and 100 is the best \n`

      console.debug(prompt);
      
      let companyScore = 0;

      const completion = await openai.chat.completions.create({
        messages: [
          { "role": "system", "content": "Only respond with a number from 1-100 detailing the impact of the headline" },
          { "role": "user", "content": prompt },
        ],
        model: "gpt-3.5-turbo",
      });

      companyScore = parseInt(completion.choices[0].message.content);

      console.debug(companyScore + "\n");
      try {
        shouldWeBuy = await canWeTrade()
      } catch (err) {
        console.log(err)
      }
      const tickerSymbol = currentEvent.symbols[0];

      if (companyScore > 70 && shouldWeBuy) {
        let order = await alpaca.createOrder({
          symbol: tickerSymbol,
          notional: 100,
          side: 'buy',
          type: 'market',
          time_in_force: 'day'
        })
        console.log(`Bought ${order.symbol} of ${order.notional}$`)
      } else if (companyScore < 30) {
        try {
          console.log("Trying to close position")
          let closedPosition = await alpaca.closedPosition({ tickerSymbol })
          console.log(closedPosition)
        } catch (err) {
          console.log("No position to close")
          console.error(err)
        }

      }
    }

    setTimeout(() => {
      bot.sendMessage(msg.chat.id, "Closing websocket")
      console.log("Closing websocket")
      wss.close();
    }, 120000);
  })

} //end of trade function




// -------------------------------------CHECKING IF WE CAN BUY-------------------------------------------------//

async function getTradedAmountToday() {
  try {
    // Get today's date in the format 'YYYY-MM-DD'
    const todayDate = new Date().toISOString().split('T')[0];

    // Get account activities for today
    const activities = await alpaca.getAccountActivities({
      date: todayDate,
    });

    // Filter only the buy trades from the activities
    const buyTrades = activities.filter(activity => activity.activity_type === 'FILL' && activity.side === 'buy');

    // Calculate the total buying amount today
    const totalBuyingAmount = buyTrades.reduce((total, trade) => {
      return total + Math.abs(parseFloat(trade.price) * parseFloat(trade.qty));
    }, 0);

    console.log('Total buying amount today:', totalBuyingAmount)

    return totalBuyingAmount;
  } catch (error) {
    console.error('Error getting total buying amount today:', error);
    throw error;
  }
}

async function canWeTrade() {
  try {
    // Get the total buying amount today
    const buyingAmountToday = await getTradedAmountToday();

    // Check if the total buying amount exceeds $5000
    if (buyingAmountToday > 5000) {
      console.log(`Total buying amount today: $${buyingAmountToday}. Cannot trade.`);
      return false;
    } else {
      console.log(`Total buying amount today: $${buyingAmountToday}. Can trade.`);
      return true;
    }
  } catch (error) {
    console.error('Error checking if we can trade:', error);
    throw error;
  }
}

// trade()

function name() {
  console.log("hello")
}
module.exports = {
  trade,
  name,
  getTradedAmountToday,
  canWeTrade
}