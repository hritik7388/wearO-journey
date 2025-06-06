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
    cron.schedule('*/5 * * * * *', async () => {
        console.log('⏰ Cron job is running every minute at', new Date().toLocaleString());

        const pendingPayments = await paymentModel.find({
            paymentStatus: "PENDING",
            orderStatus: "PROCESSING",
            paymentMode: "ONLINE"
        });

        console.log("pendingPayments=======================>>>>>", pendingPayments);

        for (const payment of pendingPayments) {
            try {
                const paymentId = payment.razorpayPaymentId; // Razorpay payment ID
                const dbPaymentId = payment._id; // MongoDB Payment _id
                const orderId = payment.orderId;

                console.log("MongoDB paymentId====================>>>>", dbPaymentId);
                console.log("Razorpay paymentId====================>>>>", paymentId);

                const razorpayPayment = await razorpay.payments.fetch(paymentId);
                console.log("razorpayPayment==================>>>>>", razorpayPayment);

                if (razorpayPayment.status == "captured") {
                    console.log(`⛔ Payment ${paymentId} not captured. Reverting...`);

                    const order = await orderModel.findById(_id);
                    console.log("order=====================>>>>",order)
                    if (order && order.items) {
                        for (const item of order.items) {
                            await inventoryModel.findByIdAndUpdate(item.inventoryId, {
                                $inc: { stockAvailable: item.quantity },
                            });
                        }
                    }

                    await orderModel.findByIdAndUpdate(orderId, {
                        orderStatus: "CANCELLED",
                    });

                    await paymentModel.findByIdAndUpdate(dbPaymentId, {
                        paymentStatus: "FAILED",
                    });

                    await orderModel.findByIdAndDelete(orderId);
                    await paymentModel.findByIdAndDelete(dbPaymentId);

                    console.log(`✅ Order ${orderId} cancelled, stock restored, and records deleted.`);
                } else {
                    console.log(`✅ Payment ${paymentId} not  captured.`);
                }
            } catch (err) {
                console.error(`❌ Error processing payment ID ${payment.razorpayPaymentId}`, err.message);
            }
        }
    });

    console.log('✅ Cron job scheduled...');
    return this;
}


    // startPaymentFallbackCron() {
    //     const job = new CronJob('* * * * * *', async () => {
    //         console.log("🕒 Running payment fallback cron every 1 sec...");

            

    //         for (const payment of pendingPayments) {
    //             try {
    //                 const paymentId = payment.razorpayPaymentId;
    //                 const razorpayPayment = await razorpay.payments.fetch(paymentId);

    //                 if (razorpayPayment.status !== "captured") {
    //                     console.log(`⛔ Payment ${paymentId} not captured. Reverting...`);

    //                     const order = await orderModel.findById(payment.orderId);
    //                     if (order && order.items) {
    //                         for (const item of order.items) {
    //                             await inventoryModel.findByIdAndUpdate(item.inventoryId, {
    //                                 $inc: { stockAvailable: item.quantity },
    //                             });
    //                         }
    //                     }

    //                     await orderModel.findByIdAndUpdate(payment.orderId, {
    //                         orderStatus: "CANCELLED",
    //                     });

    //                     await paymentModel.findByIdAndUpdate(payment._id, {
    //                         paymentStatus: "FAILED",
    //                     });

    //                     console.log(`✅ Order ${payment.orderId} cancelled and stock restored.`);
    //                 } else {
    //                     console.log(`✅ Payment ${paymentId} already captured.`);
    //                 }
    //             } catch (err) {
    //                 console.error(`❌ Error processing payment ID ${payment.razorpayPaymentId}`, err.message);
    //             }
    //         }
    //     });
    // }

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