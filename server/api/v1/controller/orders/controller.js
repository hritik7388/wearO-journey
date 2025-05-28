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
                userId,
                cartId,
                itemId,
                tax,
                shippingCharges,
                discount,
                totalAmount,
                paymentStatus,
                paymentMode,
                orderStatus,
                trackingId,
            } = validatedBody;
            const userdata = await userModel.findOne({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.USER,
            });
            console.log("userdata=====================>>>", userdata);
            if (!userdata) {
                return next(apiError.notFound(responseMessage.USER_NOT_FOUND));
            }
            const cartData = await cartModel.findOne({
                _id: validatedBody.cartId,
                status: {$ne: status.DELETE},
            });
            console.log("cartData=======================>>>>>", cartData);
            if (!cartData) {
                return next(apiError.notFound(responseMessage.CART_NOT_FOUND));
            }

            // Prepare items to order
            let itemsToOrder = [];
            console.log("itemsToOrder==================>>>>", itemsToOrder);

            if (itemId) {
                // Find the specific item in cart by itemId
                const item = cartData.items.find((i) => i._id.toString() === itemId);
                console.log("item===============>>>>", item);
                if (!item) {
                    return next(apiError.notFound("Item not found in cart"));
                }
                itemsToOrder.push(item);
            } else {
                // Order all items in cart
                itemsToOrder = cartData.items;
                console.log("itemsToOrder=================<>>>", itemsToOrder);
            }

            if (itemsToOrder.length === 0) {
                return next(apiError.badRequest("No items found to order"));
            }

            // Calculate subtotal based on itemId presence
            let subtotal;
            if (itemId) {
                // Subtotal is totalAmount of the single item
                subtotal = itemsToOrder[0].totalAmount;
                console.log("subtotal===============>>>>>", subtotal);
            } else {
                // Subtotal is cart's stored subtotal
                subtotal = cartData.subtotal;
                console.log("subtotal===============>>>>>", subtotal);
            }
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
                subtotal: subtotal,
                subtotal: subtotal,
                tax: tax || 0,
                shippingCharges: shippingCharges,
                discount: discount,
                paymentStatus,
                paymentMode,
                orderStatus,
                trackingId,
                deliveryAddress: {
                    postalCode: userdata.postalCode,
                    country: userdata.country,
                    state: userdata.state,
                    city: userdata.city,
                    street: userdata.street,
                },
            });
            return res.json(new response(createOrders, responseMessage.ORDER_CREATED));
        } catch (error) {
            console.error("Error in createorder:=====>>>>>>>>", error);
            return next(error);
        }
    }
}
export default new OrderController();
