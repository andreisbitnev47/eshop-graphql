const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const request = require('request');

function checkToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.SECRET, (err, decoded) => {
            resolve(decoded)
        });
    })
}
  
async function verifyRole(token, role, callback, rootValue) {
    const user = await checkToken(token);
    if (get(user, 'role') === role) {
        return callback();
    } else {
        console.log('Unauthorized');
        return rootValue ? { rootValue: null } : null
    }
}


function sendMail(text, subject, to) {
    return new Promise(async (resolve, reject) => {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'ecosnack.ee@gmail.com',
              pass: process.env.GMAIL_PASSWORD,
            }
        });
          
        const mailOptions = {
            from: 'ecosnack.ee@gmail.com',
            to,
            subject,
            text,
            };
        
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
                resolve(false);
            } else {
                console.log('Email sent: ' + info.response);
                resolve(true);
            }
        });
    });
}

function sendTelegramMessage(orderId, price, email) {
    try {
        const text = `New order nr ${orderId} for ${price} EUR was sent from email address ${email}`;
        request(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_ID}/sendMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&text="${text}`, function (error, response, body) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
        });
    } catch (e) {
        console.log(e);
    }
}

module.exports = {
    checkToken,
    verifyRole,
    sendMail,
    sendTelegramMessage,
}