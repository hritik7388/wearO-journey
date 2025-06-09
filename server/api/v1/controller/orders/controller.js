const Joi = require("joi");
import status from "../../../../enum/status";
import userType from "../../../../enum/userType";
import apiError from "../../../../helper/apiError";
import commonFunction from "../../../../helper/util";
import response from "../../../../../assets/response";
import userModel from "../../../../models/userModel";
import productModel from "../../../../models/productModel";
import wareHouseModel from "../../../../models/wareHouseModel";
import inventoryModel from "../../../../models/invetoryModel";
import responseMessage from "../../../../../assets/responseMessage";
import cartModel from "../../../../models/cartModel";
import orderModel from "../../../../models/orderModel";
import paymentModel from "../../../../models/paymentModel";
import orderStatus from "../../../../enum/orderStatus";
import {items} from "joi/lib/types/array";
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
    key_id: "rzp_test_XOIXzlbvgcWlzr",
    key_secret: "7FMO9e0hA3CMwofq0CxBi92q",
});

export class OrderController {
    /**
     * @swagger
     * /order/createorder:
     *   post:
     *     summary: Create a new order
     *     tags:
     *       - ORDER
     *     description: Creates a new order based on cart details and user delivery address. Shipping charges are dynamically calculated based on the nearest warehouse using Haversine formula.
     *     consumes:
     *       - application/json
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         in: header
     *         required: true
     *         type: string
     *         description: Bearer token for authentication (e.g., "Bearer <token>")
     *       - in: body
     *         name: body
     *         description: Order creation details
     *         required: true
     *         schema:
     *           type: object
     *           required:
     *             - cartId
     *             - paymentMode
     *           properties:
     *             cartId:
     *               type: string
     *               description: Cart ID from which order should be created
     *             itemId:
     *               type: string
     *               description: (Optional) Item ID from the cart to create a partial order
     *             paymentMode:
     *               type: string
     *               enum: [COD, ONLINE]
     *               description: Payment method (Cash On Delivery or Online)
     *     responses:
     *       200:
     *         description: Order successfully created
     *         schema:
     *           type: object
     *           properties:
     *             success:
     *               type: boolean
     *             message:
     *               type: string
     *             data:
     *               type: object
     *               description: Order details object
     *       400:
     *         description: Validation error or bad request
     *       401:
     *         description: Unauthorized (Invalid or missing token)
     *       404:
     *         description: User or cart not found
     *       500:
     *         description: Internal server error
     */

    async createorder(req, res, next) {
        const validationSchema = {
            cartId: Joi.string().required(),
            itemId: Joi.string().allow(null, "").optional(),
            paymentMode: Joi.string().valid("COD", "ONLINE").required(),
        };
        try {
            const validatedBody = await Joi.validate(req.body, validationSchema);
            const {
                cartId,
                itemId,

                paymentMode,
            } = validatedBody;
            const userdata = await userModel.findOne({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.USER,
            });
            if (!userdata) return next(apiError.notFound(responseMessage.USER_NOT_FOUND));

            const cartData = await cartModel.findOne({_id: cartId, status: {$ne: status.DELETE}});
            if (!cartData) return next(apiError.notFound(responseMessage.CART_NOT_FOUND));

            const inventoryData = await inventoryModel.findOne({
                _id: cartData.items[0].inventoryId,
                status: status.ACTIVE,
            });

            if (!inventoryData) {
                return next(apiError.notFound(responseMessage.CART_NOT_FOUND));
            }
            const wareHouseData = await wareHouseModel.find({
                _id: inventoryData.warehouseId,
                status: status.ACTIVE,
            });
            if (!wareHouseData.length) {
                return next(apiError.notFound(responseMessage.PRODUCT_NOT_FOUND));
            }

            const warehousesArray = wareHouseData.map((w) => ({
                _id: w._id,
                lat: w.address.location.coordinates[1],
                lon: w.address.location.coordinates[0],
                name: w.warehouseName,
            }));
            const userLocation = {
                lat: userdata.location.coordinates[1], // latitude
                lon: userdata.location.coordinates[0], // longitude
                address: userdata.address || "",
            };
            if (userLocation.lat === undefined || userLocation.lon === undefined) {
                return next(apiError.badRequest("User location coordinates are missing"));
            }
            const shippingpayment = commonFunction.getNearestWarehouseAndShippingCost(userLocation, warehousesArray);
            let itemsToOrder = [];
            if (itemId) {
                const item = cartData.items.find((i) => i._id.toString() === itemId);
                if (!item) return next(apiError.notFound("Item not found in cart"));
                itemsToOrder.push(item);
            } else {
                itemsToOrder = cartData.items;
            }
            if (itemsToOrder.length === 0) return next(apiError.badRequest("No items found to order"));
            let subtotal;
            let totalDiscount = 0;
            let totalShipping = 0;
            if (itemId) {
                subtotal = itemsToOrder[0].totalAmount;
                totalDiscount += item.discount || 0;
                totalShipping += item.shippingCharges || 0;
            } else {
                subtotal = cartData.subtotal;
                cartData.items.forEach((item) => {
                    totalDiscount += item.discount || 0;
                    totalShipping += item.shippingCharges || 0;
                });
            }
            totalShipping += shippingpayment.shippingCost;
            const finalSubtotal = subtotal + totalShipping - totalDiscount;
            const TXN = await commonFunction.generateTXNNumber();
            const createOrders = await orderModel.create({
                userId: userdata._id,
                cartId: cartData._id,
                items: itemsToOrder.map((item) => ({
                    productId: item.productId,
                    inventoryId: item.inventoryId,
                    productName: item.productName,
                    quantity: item.quantity,
                    price: item.price,
                    sizes: item.sizes,
                    colors: item.colors,
                    totalAmount: item.totalAmount,
                })),
                subtotal: finalSubtotal,
                tax: 0,
                shippingCharges: totalShipping,
                discount: totalDiscount,
                paymentStatus: "PENDING",
                paymentMode,
                orderStatus: "PROCESSING",
                trackingId: TXN,
                deliveryAddress: {
                    postalCode: userdata.zipCode,
                    country: userdata.country,
                    state: userdata.state,
                    city: userdata.city,
                    street: userdata.streetName,
                    address: userdata.address,
                    building: userdata.building,
                },
            });

            return res.json(new response(createOrders, responseMessage.ORDER_CREATED));
        } catch (error) {
            return next(error);
        }
    }

    /**
     * @swagger
     * /order/checkout:
     *   post:
     *     summary: Initiate payment for an order
     *     tags:
     *       - ORDER
     *     description: |
     *       Initiates payment using Razorpay for the given order ID.
     *       It calculates the subtotal and returns a Razorpay order object.
     *     consumes:
     *       - application/json
     *     produces:
     *       - application/json
     *     parameters:
     *       - name: token
     *         in: header
     *         required: true
     *         description: Bearer token for authentication
     *         type: string
     *       - in: body
     *         name: body
     *         required: true
     *         description: Order checkout details
     *         schema:
     *           type: object
     *           required:
     *             - orderId
     *           properties:
     *             orderId:
     *               type: string
     *               description: The ID of the order to process for payment
     *     responses:
     *       200:
     *         description: Razorpay order created successfully
     *         schema:
     *           type: object
     *           properties:
     *             responseCode:
     *               type: integer
     *             responseMessage:
     *               type: string
     *             data:
     *               type: object
     *               properties:
     *                 razorpayOrderId:
     *                   type: string
     *                 amount:
     *                   type: integer
     *                 currency:
     *                   type: string
     *       400:
     *         description: Invalid order or already paid
     *       401:
     *         description: Unauthorized (Invalid or missing token)
     *       404:
     *         description: Order not found
     *       500:
     *         description: Internal server error
     */
    async checkOut(req, res, next) {
        const validationSchema = {
            orderId: Joi.string().required(), // This is Razorpay order ID now
        };
        try {
            const validatedBody = await Joi.validate(req.body, validationSchema);
            const {orderId} = validatedBody;
            const userData = await userModel.findOne({
                _id: req.userId,
                status: status.ACTIVE,
                userType: userType.USER,
            });

            if (!userData) {
                return next(apiError.notFound(responseMessage.USER_NOT_FOUND));
            }
            const order = await orderModel.findOne({
                _id: orderId,
            });

            if (!order) {
                return next(apiError.notFound("Order not found"));
            }

            if (order.paymentStatus === "PAID") {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: "Order already paid",
                });
            }

            if (order.paymentMode === "COD") {
                return res.status(200).json({
                    responseCode: 200,
                    responseMessage: "Cash on Delivery - payment to be handled manually",
                    data: {
                        orderStatus: order.orderStatus,
                        paymentMode: order.paymentMode,
                        paymentStatus: order.paymentStatus,
                    },
                });
            }

            const amount = order.subtotal || 0;
            if (amount <= 0) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: "Invalid order subtotal",
                });
            }
            const paymentLink = await razorpay.paymentLink.create({
                amount: Math.round(amount * 100),
                currency: "INR",
                accept_partial: false,
                reference_id: order._id.toString(),
                description: "Order Payment",
                customer: {
                    name: `${userData.firstName} ${userData.lastName}`,
                    email: userData.email,
                },
                notify: {
                    sms: true,
                    email: true,
                },
                reminder_enable: true,
                callback_url: "https://yourdomain.com/verify-payment",
                callback_method: "get",
            });
            console.log("paymentLink==================================>>>>",paymentLink)

            order.razorpayPaymentLinkId = paymentLink.id;
            await order.save();
             // Create payment entry with status PENDING
        await paymentModel.create({
            userId: userData._id,
            cartId: order.cartId || null,
            orderId: order._id,
            paymentStatus: "PENDING",
            paymentMode: order.paymentMode,
            orderStatus: order.orderStatus,
            razorpayPaymentLinkId: paymentLink.id,
        });
            return res.status(200).json({
                responseCode: 200,
                responseMessage: "Payment link created successfully",
                data: {
                    paymentLink: paymentLink.short_url,
                    razorpayPaymentLinkId: paymentLink.id,
                },
            });
        } catch (error) {
            console.log("Checkout Error =====>", error);
            return next(error);
        }
    }

    async razorpayWebhook(req, res) {
        const secret = "hb@123";
        const receivedSig = req.headers["x-razorpay-signature"];
        const body = req.body;

        const expectedSig = crypto.createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");

        if (expectedSig !== receivedSig) {
            return res.status(400).send("Invalid signature");
        }

        const orderId = body.payload.order.entity.receipt;
        console.log("orderId=============================>>>>>",orderId)
        const razorpayOrderId = body.payload.payment.entity.order_id;
        const razorpayPaymentId = body.payload.payment.entity.id;

        try {
            const existingOrder = await orderModel.findById(orderId);
            if (!existingOrder) {
                return res.status(404).json({success: false, message: "Order not found"});
            }
            const items = existingOrder.items || [];
            for (const item of items) {
                const {inventoryId, quantity} = item;
                await inventoryModel.findByIdAndUpdate(inventoryId, {
                    $inc: {stockAvailable: -quantity},
                });
            }
            const updatedOrder = await orderModel.findByIdAndUpdate(
                orderId,
                {
                    paymentStatus: "PAID",
                    razorpay_signature: expectedSig,
                    razorpayOrderId,
                    razorpayPaymentId,
                    orderStatus: orderStatus.CONFIRMED,
                },
                {new: true}
            );
      await paymentModel.findOneAndUpdate(
            { orderId: orderId },
            {
                paymentStatus: "PAID",
                paymentMode: "ONLINE",
                orderStatus: orderStatus.CONFIRMED,
                razorpay_signature: expectedSig,
                razorpayOrderId,
                razorpayPaymentId,
            },
            { new: true }
        );

            res.status(200).json({
                success: true,
                message: "Payment verified and inventory updated successfully",
                data: {
                    updatedOrder,
                    razorpay_order_id: razorpayOrderId,
                    razorpay_payment_id: razorpayPaymentId,
                },
            });
        } catch (err) {
            console.error("❗ Error:", err);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

/**
 * @swagger
 * /order/manualOrderPaid:
 *   post:
 *     summary: Manually mark a COD order as paid
 *     tags:
 *       - ORDER
 *     description: |
 *       Allows a delivery boy to manually mark a Cash on Delivery (COD) order as paid.
 *       This updates the payment status in both the order and payment models.
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: token
 *         in: header
 *         required: true
 *         description: Bearer token for authentication
 *         type: string
 *       - in: body
 *         name: body
 *         required: true
 *         description: Order details for marking as paid
 *         schema:
 *           type: object
 *           required:
 *             - orderId
 *           properties:
 *             orderId:
 *               type: string
 *               description: The ID of the COD order to mark as paid
 *     responses:
 *       200:
 *         description: Order and payment marked as paid successfully 
 *       400:
 *         description: Invalid order or payment mode is not COD
 *       401:
 *         description: Unauthorized (Invalid or missing token)
 *       404:
 *         description: User or order not found
 *       500:
 *         description: Internal server error
 */

    async manualOrderPaid(req, res, next) {
        const validationSchema = {
            orderId: Joi.string().required(),
        };
        try {
            const validatedBody = await Joi.validate(req.body, validationSchema);
            const {orderId} = validatedBody;
            const userId = await userModel.findOne({
                _id: req.userId,
                status: status.ACTIVE,
                userType: userType.DELIVERYBOY,
            });
            if (!userId) {
                return next(apiError.notFound(responseMessage.USER_NOT_FOUND));
            }
            const order = await orderModel.findOne({
                _id: validatedBody.orderId, 
            });

            if (!order) {
                return next(apiError.notFound(responseMessage.ORDER_NOT_FOUND));
            } 
            if (order.paymentMode !== "COD") {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: "Payment mode is not COD. Cannot manually mark as paid.",
                });
            }
            const updatedOrder = await orderModel.findByIdAndUpdate(
                {_id: validatedBody.orderId},
                {
                    $set: {
                        paymentStatus: "PAID",
                        orderStatus: "DELIVERED",  
                    },
                },
                {new: true}
            );
            const paymentRecord = await paymentModel.findOne({
                orderId: orderId,
            });

            if (paymentRecord) {
                await paymentModel.findByIdAndUpdate(
                    paymentRecord._id,
                    {
                        $set: {
                            paymentStatus: "PAID",
                            paymentMode: "COD",
                            orderStatus: "DELIVERED",  
                            updatedBy: req.userId,  
                        },
                    },
                    {new: true}
                );
            }

            return res.status(200).json({
                responseCode: 200,
                responseMessage: "Order and payment marked as paid manually",
                data: {
                    orderId: updatedOrder._id,
                    paymentStatus: updatedOrder.paymentStatus,
                    orderStatus: updatedOrder.orderStatus,
                },
            });
        } catch (error) {
            return next(error);
        }
    }
}
export default new OrderController();

// Restore stock for the removed quantity
// await inventoryModel.findByIdAndUpdate(item.inventoryId, {
//     $inc: { stockAvailable: oldQuantity }
// });

// Remove the item from cart

// const diff = quantity - oldQuantity;

// quantity > 0, normal update flow
// if (diff > 0 && inventory.stockAvailable < diff) {
//     throw apiError.badRequest(responseMessage.OUT_OF_STOCK);
// }

// await inventoryModel.findByIdAndUpdate(item.inventoryId, {
//     $inc: { stockAvailable: -diff }
// });
