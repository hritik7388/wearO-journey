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
import {items} from "joi/lib/types/array";
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
    key_id: "rzp_test_XOIXzlbvgcWlzr",
    key_secret: "7FMO9e0hA3CMwofq0CxBi92q"
});

export class OrderController {
    /**
     * @swagger
     * /order/createorder:
     *   post:
     *     summary: Create a new order
     *     tags:
     *       - ORDER
     *     description: Creates a new order based on cart details and user delivery address.
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
     *         description: Order creation details
     *         schema:
     *           type: object
     *           required:
     *             - cartId
     *             - paymentMode
     *           properties:
     *             cartId:
     *               type: string
     *             itemId:
     *               type: string
     *               description: Optional. Use to create order for a specific item in cart.
     *             shippingCharges:
     *               type: number
     *               default: 0
     *             discount:
     *               type: number
     *               default: 0
     *             paymentStatus:
     *               type: string
     *               enum: [PENDING, PAID, FAILED, REFUNDED]
     *               default: PENDING
     *             paymentMode:
     *               type: string
     *               enum: [COD, ONLINE]
     *             orderStatus:
     *               type: string
     *               enum: [PLACED, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
     *               default: PROCESSING
     *             trackingId:
     *               type: string
     *     responses:
     *       200:
     *         description: Order successfully created
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
            shippingCharges: Joi.number().default(0),
            discount: Joi.number().default(0),
            paymentStatus: Joi.string().valid("PENDING", "PAID", "FAILED", "REFUNDED").default("PENDING"),
            paymentMode: Joi.string().valid("COD", "ONLINE").required(),
            orderStatus: Joi.string()
            .valid("PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED")
            .default("PROCESSING"),
            trackingId: Joi.string().optional(),
        };
        try {
    const validatedBody = await Joi.validate(req.body, validationSchema);
    const {
      cartId,
      itemId,
      tax,
      shippingCharges,
      discount,
      paymentStatus,
      paymentMode,
      orderStatus,
    } = validatedBody;

    // Fetch user and cart same as before
    const userdata = await userModel.findOne({ _id: req.userId, status: { $ne: status.DELETE }, userType: userType.USER });
    if (!userdata) return next(apiError.notFound(responseMessage.USER_NOT_FOUND));

    const cartData = await cartModel.findOne({ _id: cartId, status: { $ne: status.DELETE } });
    if (!cartData) return next(apiError.notFound(responseMessage.CART_NOT_FOUND));

    let itemsToOrder = [];
    if (itemId) {
      const item = cartData.items.find(i => i._id.toString() === itemId);
      if (!item) return next(apiError.notFound("Item not found in cart"));
      itemsToOrder.push(item);
    } else {
      itemsToOrder = cartData.items;
    }
    if (itemsToOrder.length === 0) return next(apiError.badRequest("No items found to order"));

    let subtotal;
    if (itemId) {
      subtotal = itemsToOrder[0].totalAmount;
    } else {
      subtotal = cartData.subtotal;
    }

    // Razorpay order creation
    const razorpayOrderOptions = {
    amount: Math.floor(subtotal * 100), // amount in paise (multiply by 100)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1, // auto capture payment
      notes: {
        userId: userdata._id.toString(),
        cartId: cartData._id.toString(),
      },
    };

    const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);
    console.log("Razorpay Order created:", razorpayOrder);

    // Generate your own trackingId (TXN)
    const TXN = await commonFunction.generateTXNNumber();

    // Create your order in DB including razorpayOrderId
    const createOrders = await orderModel.create({
      userId: userdata._id,
      cartId: cartData._id,
      items: itemsToOrder.map(item => ({
        productId: item.productId,
        inventoryId: item.inventoryId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        sizes: item.sizes,
        colors: item.colors,
        totalAmount: item.totalAmount,
      })),
      subtotal: subtotal,
      tax: tax || 0,
      shippingCharges: shippingCharges,
      discount: discount,
      paymentStatus,
      paymentMode,
      orderStatus,
      trackingId: TXN,
      razorpayOrderId: razorpayOrder.id,  // Store razorpay order id here
      deliveryAddress: {
        postalCode: userdata.zipCode,
        country: userdata.country,
        state: userdata.state,
        city: userdata.city,
        street: userdata.streetName,
        address: userdata.address,
        building: userdata.building,
    },
    razorpayOrderId: razorpayOrder.id
    });

    return res.json(new response(createOrders, responseMessage.ORDER_CREATED));
  } catch (error) {
    console.error("Error in createorder:=====>>>>>>>>", error);
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
        orderId: Joi.string().required(),  // This is Razorpay order ID now
    };


  try {
    const validatedBody = await Joi.validate(req.body, validationSchema);
    const { orderId } = validatedBody;

    // 🔍 Find user
    const userData = await userModel.findOne({
      _id: req.userId,
      status: status.ACTIVE,
      userType: userType.USER,
    });

    if (!userData) {
      return next(apiError.notFound(responseMessage.USER_NOT_FOUND));
    }

    // 🔍 Find order by Razorpay Order ID
    const order = await orderModel.findOne({
      razorpayOrderId: orderId,
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

    const amount = order.subtotal || 0;
    if (amount <= 0) {
      return res.status(400).json({
        responseCode: 400,
        responseMessage: "Invalid order subtotal",
      });
    }

    // 🧾 Create Razorpay Payment Link
    const paymentLink = await razorpay.paymentLink.create({
      amount: Math.round(amount * 100), // in paise
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
      callback_url: "https://yourdomain.com/verify-payment", // Replace with your callback handler
      callback_method: "get",
    }); 
    

    // 💾 Optional: Save payment link ID
    order.razorpayPaymentLinkId = paymentLink.id;
    await order.save(); 


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
  const receivedSig = req.headers['x-razorpay-signature'];
  const body = req.body; 
  console.log("body=====================>>>>",body.payload.order)
    console.log("body=====================>>>>",body.payload.payment)
      // console.log("body=====================>>>>",body.payload.order)
  
  const expectedSig = crypto
  .createHmac("sha256", secret)
  .update(JSON.stringify(body))
  .digest("hex");
  
  console.log("🧮 Expected Signature:", expectedSig);
  
  if (expectedSig !== receivedSig) { 
    return res.status(400).send("Invalid signature");
  } ;

const orderId = body.payload.order.entity.receipt;
  console.log("orderId========::>>>>>>",orderId)

  // Process the webhook event
  const razorpayOrderId = body.payload.payment.entity.order_id;
  const razorpayPaymentId = body.payload.payment.entity.id;
  
  console.log("🔐 Received Signature:", receivedSig); 
  console.log("📌 Razorpay Order ID:", razorpayOrderId);
  console.log("💳 Razorpay Payment ID:", razorpayPaymentId);

  try {
    const updatedOrder = await orderModel.findOneAndUpdate(
      { _id :orderId},
      {
        paymentStatus: "PAID",
        razorpayPaymentId,        
        razorpay_signature: expectedSig,
        razorpayOrderId:razorpayOrderId,
        razorpayPaymentId:razorpayPaymentId
      },
      { new: true }
    ); 
    console.log("updatedOrder=======================================>>>>",updatedOrder)

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: {
        updatedOrder,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      }
    });
  } catch (err) {
    console.error("❗ Error updating order:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}


}
export default new OrderController();


// Key ID:rzp_test_XOIXzlbvgcWlzr
// Key Secret:

// await inventoryModel.findByIdAndUpdate(inventoryId, {
//     $inc: { stockAvailable: -quantity },
// });

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
