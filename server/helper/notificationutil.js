import admin from 'firebase-admin';
// import serviceAccount from '../../config/fcmServiceAccount.json';


// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// })

const notificationOptions = {
    priority: "high",
    timeToLive: 60 * 60 * 24
}

const sendNotification = async (fcmToken, payload) => {
    var result = await admin.messaging().sendToDevice(fcmToken, payload, notificationOptions);
    console.log("result", result)
    return result;
}

module.exports = {
    sendNotification
};