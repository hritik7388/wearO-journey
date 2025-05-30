import config from "config";
import jwt from "jsonwebtoken";
const fs = require("fs");
import FCM from "fcm-push";
import AWS from "aws-sdk";
import ses from "node-ses";
// import mailTemplet from "../helper/mailtemplet";
const Sender = require("aws-sms-send");

import cloudinary from "cloudinary";
import nodemailer from "nodemailer";

// const accountSid = config.get("twilio.accountSid");
// const authToken = config.get("twilio.authToken");
// const client = require("twilio")(accountSid, authToken);

// cloudinary.config({
//   cloud_name: config.get('cloudinary.cloud_name'),
//   api_key: config.get('cloudinary.api_key'),
//   api_secret: config.get('cloudinary.api_secret')
// });

// const s3 = new AWS.S3({
//   accessKeyId: config.get("AWS.accessKeyId"),
//   secretAccessKey: config.get("AWS.secretAccessKey"),
// });

// AWS.config.update({
//   accessKeyId: config.get("AWS.accessKeyId"),
//   secretAccessKey: config.get("AWS.secretAccessKey"),
//   region: 'ap-south-1',
//   // region: config.get("AWS.region"),

// });
// const sns = new AWS.SNS();

// AWS.config.update({ region:"ap-south-1"});
// const sns = new AWS.SNS({
// accessKeyId: config.get("AWS.accessKeyId"),
// secretAccessKey: config.get("AWS.secretAccessKey"),
// region: config.get("AWS.region"),
// });

// const serverKey = config.get("pushNotificationServerkey");
// const fcm = new FCM(serverKey);

module.exports = {
    getOTP() {
        var otp = Math.floor(100000 + Math.random() * 900000);
        return otp;
    },

    generateTagNumber() {
        const tagNumber = `TGN-${Math.floor(100000 + Math.random() * 900000)}`;
        return tagNumber;
    },

    genId() {
        var ID = Math.floor(10000000000 + Math.random() * 90000000000);
        return ID;
    },
    generateTXNNumber() {
        const tagNumber = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
        return tagNumber;
    },
    dateTime() {
        var today = new Date(new Date() - new Date().getTimezoneOffset() * 60 * 1000).toISOString();
        var check = "";
        check = today.split(".")[0].split("T");
        var time = check[1].split(":")[0] > "11" ? " PM" : " AM";
        check = check[0].split("-").reverse().join("/") + " " + check[1] + time;
        return check;
    },

    makeReferral() {
        var result = "";
        var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var charactersLength = characters.length;
        for (var i = 0; i < 6; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },

    getToken: async (payload) => {
        var token = await jwt.sign(payload, config.get("jwtsecret"), {
            expiresIn: "24h",
        });
        console.log("getToken==================>>>>", token);
        return token;
    },

    sendMail: async (to, subject, body) => {
        const msg = {
            to: to, // Change to your recipient
            from: "no-replymailer@mobiloitte.com", // Change to your verified sender
            subject: subject,
            text: body,
        };
        sgMail
        .send(msg)
        .then((response) => {
            console.log(response[0].statusCode);
            console.log(response[0].headers);
        })
        .catch((error) => {
            console.error(error);
        });
    },

    getImageUrl: async (files) => {
        var mediaURL;
        var date = new Date().getTime();
        const fileContent = fs.readFileSync(files[0].path);
        const params = {
            Bucket: config.get("AWS.bucketName"),
            ContentType: files[0].mimetype,
            Key: `uploads/${date}${files[0].filename}`,
            Body: fileContent,
        };
        let data = await s3.upload(params).promise();
        mediaURL = data.Location;
        return mediaURL;
    },

    uploadToS3: async (base64) => {
        const buffer = Buffer.from(base64, "base64");
        const params = {
            Bucket: config.get("AWS.bucketName"),
            ContentType: "image/png",
            Key: `uploads/${Date.now()}/image.png`, // Replace with your desired key structure
            Body: buffer,
            // ACL: 'private' // Set the ACL as needed (private, public-read, etc.)
        };
        try {
            const result = await s3.upload(params).promise();
            console.log("result========================>>>", result.Location);
            return result.Location; // Return the URL of the uploaded image
        } catch (error) {
            console.error("Error uploading to S3:", error);
            throw error;
        }
    },

    getImageUrl: async (files) => {
        var result = await cloudinary.v2.uploader.upload(files[0].path, {resource_type: "auto"});
        return result.secure_url;
    },
    getSecureUrl: async (base64) => {
        var result = await cloudinary.v2.uploader.upload(base64, {resource_type: "auto"});
        return result.secure_url;
    },
    uploadImage(image) {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload(image, function (error, result) {
                if (error) {
                    reject(error);
                } else {
                    console.log("result===>>", result.url);
                    resolve(result.url);
                }
            });
        });
    },

    // sendSmsTwilio: async (mobileNumber, otp)=> {
    //   const message = `Your mobile One Time Password (OTP) to log in to your digital bank account is ${otp}. The OTP is valid for 3 minutes.`;
    //   const params = {
    //     Message: message,
    //     PhoneNumber: mobileNumber,
    //   }

    //   try {
    //     const response = await sns.publish(params).promise();
    //     console.log('SMS sent using AWS SNS:', response);
    //     return response;
    //   } catch (error) {
    //     console.error('Error sending SMS using AWS SNS:', error);
    //     throw error;
    //   }
    // },
    sendSmsTwilio: async (mobileNumber, otp) => {
        try {
            return await client.messages.create({
                body: `Your mobile One Time Password (OTP) to log in to your digital bank account is ${otp}.The OTP is valid for 3 minutes.`,
                to: mobileNumber,
                from: config.get("twilio.number"),
            });
        } catch (error) {
            console.log("160 ==>", error);
        }
    },
    randomString: (length) => {
        let result = "";
        let chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
        return result;
    },
    //************************************ PUSH NOTIFICATIONS ************************************************************ */

    // pushNotification: (deviceToken, subject, body, callback) => {
    //   var message = {
    //     to: deviceToken, // required fill with device token or topics
    //     content_available: true,
    //     notification: {
    //       subject: subject,
    //       // title: title,
    //       body: body,
    //     },
    //   };
    //   fcm.send(message, function (err, response) {
    //     if (err) {
    //       console.log("err", err);
    //       callback(err, null);
    //     } else {
    //       console.log("response", response);
    //       callback(null, response);
    //     }
    //   });
    // },

    // pushNotificationDelhi: (deviceToken, title, body, callback) => {
    //   var message = {
    //     to: deviceToken, // required fill with device token or topics
    //     content_available: true,
    //     notification: {
    //       title: title,
    //       body: body,
    //     },
    //     data: {
    //       title: title,
    //       body: body,
    //     },
    //   };
    //   fcm.send(message, function (err, response) {
    //     if (err) {
    //       console.log("err", err);
    //       callback(err, null);
    //     } else {
    //       console.log("response", response);
    //       callback(null, response);
    //     }
    //   });
    // },

    // ************************************ MAIL FUNCTIONALITY WITH NodeMailer *****************************************************/

    sendMailOtpForgetAndResend: async (email, otp) => {
        let html = mailTemplet.otpForgetResetTemplet(otp);
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: "Resend OTP",
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendMailOtpNodeMailer: async (email, otp) => {
        let html = mailTemplet.signUpTemplet(otp);
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.user"),
                pass: config.get("nodemailer.pass"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: "Welcome to Rival - Email OTP Confirmation ",
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendKycEmail: async (email, name) => {
        let html = mailTemplet.addKycTemplet(name);
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.user"),
                pass: config.get("nodemailer.pass"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: "KYC Submission Received",
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },
    sendMailKYCapprove: async (email, body) => {
        let html = mailTemplet.mailKYCApproveTemplet(body);
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: "Successful KYC Verification ",
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendPassConfirmationMail: async (email) => {
        let html = mailTemplet.sendPassConfirmationMailTemplet();
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.user"),
                pass: config.get("nodemailer.pass"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: "Reset password Successful",
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendConfirmationMail: async (email) => {
        let html = mailTemplet.sendConfirmationMailTemplet();
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: "Reset password Successful",
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendMailKYCreject: async (email, body) => {
        let html = mailTemplet.mailKYCRejectTemplet(body);
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: "Failed KYC Verification ",
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendMailStakeReject: async (email, body) => {
        let html = mailTemplet.mailStakeRejectTemplet(body);
        let subject = "STAKE STATUS";
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: subject,
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendMailStakeAccept: async (email, body) => {
        let html = mailTemplet.mailStakeAcceptTemplet(body);
        let subject = "STAKE STATUS";
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: subject,
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendMailExchangeReject: async (email, body) => {
        let html = mailTemplet.mailExchangeRejectTemplet(body);
        let subject = "EXCHANGE STATUS";
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: subject,
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendMailExchangeAccept: async (email, body) => {
        let html = mailTemplet.mailExchangeAcceptTemplet(body);
        let subject = "EXCHANGE STATUS";
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: subject,
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },
    sendEmailLoginCredential: async (email, body) => {
        let html = mailTemplet.mailLoginCredentialTemplet(body);
        let subject = "EXCHANGE STATUS";
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: subject,
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendEmailForDeposit: async (email, body) => {
        let html = mailTemplet.depositmailTemp(body);
        let subject = "Deposit Successful";
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: subject,
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },

    sendEmailForWithdraw: async (email, body) => {
        let html = mailTemplet.withdrawMailTemp(body);
        let subject = "Withdrawal Successful";
        var transporter = nodemailer.createTransport({
            service: config.get("nodemailer.service"),
            auth: {
                user: config.get("nodemailer.email"),
                pass: config.get("nodemailer.password"),
            },
        });
        var mailOptions = {
            from: "<do_not_reply@gmail.com>",
            to: email,
            subject: subject,
            html: html,
        };
        return await transporter.sendMail(mailOptions);
    },
    
 getNearestWarehouseAndShippingCost(userLocation, warehouses) {
  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  function getDistanceInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  let nearestWarehouse = null;
  let minDistance = Infinity;

  warehouses.forEach(warehouse => {
    const distance = getDistanceInKm(
      userLocation.lat,
      userLocation.lon,
      warehouse.lat,
      warehouse.lon
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestWarehouse = { ...warehouse, distance };
    }
  });

  const costPerKm = 10;
  const shippingCost = Math.max(50, Math.round(nearestWarehouse.distance * costPerKm));

  return {
    nearestWarehouse,
    distance: nearestWarehouse.distance.toFixed(2),
    shippingCost,
  };
}

};
