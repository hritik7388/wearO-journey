import express from "express";
import Mongoose from "mongoose";
import * as http from "http";
import * as path from "path";
import cors from "cors";
import morgan from "morgan";
import socket from "socket.io";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import apiErrorHandler from "../helper/apiErrorHandler";
import paymentModel from '../models/paymentModel'
import orderModel from '../models/orderModel'
import invetoryModel from "../models/invetoryModel";
import cartModel from '../models/cartModel'
import dotenv from "dotenv";
import orderRoutes from '../routes';
import orderStatus from "../enum/orderStatus";
const cron = require('node-cron');
const Razorpay = require("razorpay");
const crypto = require("crypto");
const razorpay = new Razorpay({
    key_id: "rzp_test_XOIXzlbvgcWlzr",
    key_secret: "7FMO9e0hA3CMwofq0CxBi92q",
});

dotenv.config();
const app = new express();
const server = http.createServer(app); 
app.use(express.json());
 
app.get('/index.html', (req, res) => {
  app.use(express.static(path.join(__dirname, 'frontend')));

});
 
const root = path.normalize(`${__dirname}/../..`);
class ExpressServer {
    constructor() {
        app.use(express.json({
            limit: "1000mb"
        }));
        // app.use('/api/v1/order', orderRoutes);


        app.use(express.urlencoded({
            extended: true,
            limit: "1000mb"
        }));

        app.use(morgan("dev"));

        app.use(
            cors({
                allowedHeaders: ["Content-Type", "token", "authorization"],
                exposedHeaders: ["token", "authorization"],
                origin: "*",
                methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
                preflightContinue: false,
            })
        );
 
    }
    router(routes) {
        routes(app);
        return this;
    }

    configureSwagger(swaggerDefinition) {
        const options = {
            swaggerDefinition,
            apis: [
                path.resolve(`${root}/server/api/v1/controller/**/*.js`, ),
                path.resolve(`${root}/api.yaml`),
            ],

        };

        app.use(
            "/api-docs",
            swaggerUi.serve,
            swaggerUi.setup(swaggerJSDoc(options))
        );
        return this;
    }

    handleError() {
        app.use(apiErrorHandler);

        return this;
    }

  async configureDb(dbUrl) {
      try {
          await Mongoose.connect(dbUrl, {
              useNewUrlParser: true,
              useUnifiedTopology: true,
          });
          console.log("Connected to the database successfully");
      } catch (error) {
          console.error("Database connection error:", error);
          throw error;
      }
  }
setupCronJobs() {
  const cron = require('node-cron');
  const moment = require('moment'); // Make sure to install moment or use native Date

  cron.schedule('*/5 * * * * *', async () => {
    try {
      console.log('⏰ Cron job is running at', new Date().toLocaleString());

      const oneMinuteAgo = moment().subtract(2, 'minutes').toDate();
      const twoMinutesAgo = moment().subtract(1, 'minutes').toDate();

      const paymentData = await paymentModel.find({
        orderStatus: "PROCESSING",
        paymentMode: "ONLINE",
        paymentStatus: "PENDING",
        createdAt: { $gte: oneMinuteAgo, $lte: twoMinutesAgo } // Between 1–2 minutes ago
      });

      console.log("🎯 Matching payments:", paymentData.length);

      for (const payment of paymentData) {
        const orderData = await orderModel.findOne({ _id: payment.orderId });
        if (!orderData) {
          console.warn(`❗ Order not found for orderId: ${payment.orderId}`);
          continue;
        }

        const cartData = orderData.cartId
          ? await cartModel.findOne({ _id: orderData.cartId })
          : null;

        // ✅ Restore inventory
        if (cartData && cartData.items && cartData.items.length){
          for (const cartItem of cartData.items) {
            if (cartItem.inventoryId && cartItem.quantity) {
              const inventory = await invetoryModel.findOne({ _id: cartItem.inventoryId });
              if (inventory) {
                inventory.stockAvailable += cartItem.quantity;
                await inventory.save();
                console.log(`✅ Restored ${cartItem.quantity} units to inventoryId: ${cartItem.inventoryId}`);
              }
            }
          }
        }

        let isRefunded = false;

        if (payment.razorpayPaymentId) {
          try {
            await commonFunction.refund(payment.razorpayPaymentId);
            isRefunded = true;
            console.log(`✅ Refund success for paymentId: ${payment.razorpayPaymentId}`);
          } catch (refundErr) {
            console.error(`❌ Refund failed for ${payment.razorpayPaymentId}`);
          }
        }

        // ✅ Only update status and delete order if refund was successful
        if (isRefunded) {
          await paymentModel.updateOne(
            { _id: payment._id },
            { $set: { orderStatus: "FAILED", paymentStatus: "FAILED" } }
          );
          console.log(`📝 Payment status updated to FAILED for paymentId: ${payment._id}`);

          await orderModel.deleteOne({ _id: orderData._id });
          console.log(`🗑️ Deleted orderId: ${orderData._id}`);
        }
      }
    } catch (err) {
      console.error("❌ Error in cron job:", err);
    }
  });

  console.log('✅ Cron job scheduled...');
  return this;
}



    listen(port) {
        server.listen(port, () => {
            console.log(
                `secure app is listening 🌍 @port ${port}`,
                new Date().toLocaleString()
            );
        });
        return app;
    }

}

export default ExpressServer;