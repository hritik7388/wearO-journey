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

export class CartController {
    /**
     * @swagger
     * /cart/addProductToCart:
     *   post:
     *     summary: Add product(s) to cart
     *     tags:
     *       - CART
     *     description: Adds product(s) to the user's cart. Price will be fetched automatically from inventory.
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
     *         description: Cart item details
     *         schema:
     *           type: object
     *           required:
     *             - items
     *           properties:
     *             items:
     *               type: array
     *               items:
     *                 type: object
     *                 required:
     *                   - productId
     *                   - inventoryId
     *                   - quantity
     *                   - colors
     *                   - sizes
     *                 properties:
     *                   productId:
     *                     type: string
     *                   inventoryId:
     *                     type: string
     *                   quantity:
     *                     type: number
     *                   colors:
     *                     type: array
     *                     items:
     *                       type: string
     *                   sizes:
     *                     type: array
     *                     items:
     *                       type: string
     *     responses:
     *       200:
     *         description: Cart successfully updated or created
     *       400:
     *         description: Validation error or out-of-stock
     *       404:
     *         description: Inventory not found
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Internal server error
     */

async addProductToCart(req, res, next) {
    const validationSchema = {
        items: Joi.array()
            .items(
                Joi.object({
                    productId: Joi.string().required(),
                    inventoryId: Joi.string().required(),
                    quantity: Joi.number().min(1).required(),
                    colors: Joi.array().items(Joi.string()).required(),
                    sizes: Joi.array().items(Joi.string()).required(),
                })
            )
            .min(1)
            .required(),
    };

    try {
        const validatedBody = await Joi.validate(req.body, validationSchema);
        const { productId, inventoryId, quantity, colors, sizes } = validatedBody.items[0];

        const userData = await userModel.findOne({
            _id: req.userId,
            userType: userType.USER,
            status: { $ne: status.DELETE },
        });
        if (!userData) throw apiError.notFound(responseMessage.USER_NOT_FOUND);

        const productData = await productModel.findOne({
            _id: productId,
            status: { $ne: status.DELETE },
        });
        if (!productData) throw apiError.notFound(responseMessage.PRODUCT_NOT_FOUND);

        const inventoryData = await inventoryModel.findOne({
            _id: inventoryId,
            productId,
            status: status.ACTIVE,
        });
        if (!inventoryData) throw apiError.notFound(responseMessage.INVENTORY_NOT_FOUND);

        // Check available colors and sizes
        const unavailableColors = colors.filter(c => !inventoryData.colors.includes(c));
        if (unavailableColors.length > 0) {
            return res.status(400).json({
                status: 400,
                message: `Color(s) [${unavailableColors.join(", ")}] not available.`,
            });
        }

        const unavailableSizes = sizes.filter(s => !inventoryData.sizes.includes(s));
        if (unavailableSizes.length > 0) {
            return res.status(400).json({
                status: 400,
                message: `Size(s) [${unavailableSizes.join(", ")}] not available.`,
            });
        }

        const productPrice = productData.price || 0; 
        let cart = await cartModel.findOne({ userId: req.userId, status: "ACTIVE" });

        if (!cart) { 
            cart = new cartModel({
                userId: req.userId,
                items: [],
                subtotal: 0,
                status: "ACTIVE",
            });
        } 
        let existingItemIndex = cart.items.findIndex(
            item =>
                item.productId.toString() === productId &&
                item.inventoryId.toString() === inventoryId &&
                JSON.stringify(item.colors.sort()) === JSON.stringify(colors.sort()) &&
                JSON.stringify(item.sizes.sort()) === JSON.stringify(sizes.sort())
        );

        if (existingItemIndex !== -1) {
            const existingItem = cart.items[existingItemIndex];
            const newQuantity = existingItem.quantity + quantity;

            if (inventoryData.stockAvailable < newQuantity) {
                throw apiError.badRequest(responseMessage.OUT_OF_STOCK);
            }

            cart.items[existingItemIndex].quantity = newQuantity;
            cart.items[existingItemIndex].totalAmount = newQuantity * productPrice;
        } else { 
            if (inventoryData.stockAvailable < quantity) {
                throw apiError.badRequest(responseMessage.OUT_OF_STOCK);
            }

            cart.items.push({
                productId,
                inventoryId,
                productName: productData.productName,
                quantity,
                price: productPrice,
                colors,
                sizes,
                totalAmount: quantity * productPrice,
            });
        } 
        cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalAmount, 0);

        await cart.save(); 
       

        const addedItem = existingItemIndex !== -1 ? cart.items[existingItemIndex] : cart.items[cart.items.length - 1];

        return res.status(200).json({
            responseCode: 200,
            responseMessage: responseMessage.CART_CREATED,
            data: addedItem,
            subtotal: cart.subtotal,
        });
    } catch (error) {
        console.error("Error in addProductToCart:", error);
        return next(error);
    }
}




/**
 * @swagger
 * /cart/updateProductToCart:
 *   put:
 *     summary: Update quantity of a product in the cart
 *     tags:
 *       - CART
 *     description: Updates the quantity of an existing product in the user's cart. Also adjusts inventory stock.
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
 *         description: Cart update details
 *         schema:
 *           type: object
 *           required:
 *             - _id
 *             - itemId
 *             - quantity
 *           properties:
 *             _id:
 *               type: string
 *               description: Cart ID
 *             itemId:
 *               type: string
 *               description: Item ID inside cart (cart.items array)
 *             quantity:
 *               type: number
 *               description: New quantity for the item (minimum 1)
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       400:
 *         description: Validation error or out-of-stock
 *       404:
 *         description: Cart or item or inventory not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

async updateProductToCart(req, res, next) {
    const validationSchema = {
        _id: Joi.string().required(),
        itemId: Joi.string().required(),
        quantity: Joi.number().min(0).required()  // note: min changed from 1 to 0
    };

    try {
        const validatedBody = await Joi.validate(req.body, validationSchema);
        const { _id, itemId, quantity } = validatedBody;

        const userData = await userModel.findOne({
            _id: req.userId,
            userType: userType.USER,
            status: { $ne: status.DELETE },
        });
        if (!userData) throw apiError.notFound(responseMessage.USER_NOT_FOUND);

        const cart = await cartModel.findOne({
            _id:validatedBody._id,
            userId: userData._id,
            status: status.ACTIVE,
        });
        if (!cart) throw apiError.notFound("Cart not found");

        const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex === -1) throw apiError.notFound("Cart item not found");
        console.log("itemIndex============>>>",itemIndex)

        const item = cart.items[itemIndex]; 
        

        const inventory = await inventoryModel.findOne({
            _id: item.inventoryId,
            productId: item.productId,
            status: status.ACTIVE
        });
        if (!inventory) throw apiError.notFound("Inventory not found");

        if (quantity === 0) {
          
            cart.items.splice(itemIndex, 1);

            // Update subtotal
            cart.subtotal = cart.items.reduce((sum, itm) => sum + itm.totalAmount, 0);

            // If no items left, delete cart
            if (cart.items.length === 0) {
                await cartModel.findByIdAndDelete(cart._id);
                return res.status(200).json({
                    responseCode: 200,
                    responseMessage: "Item removed and cart deleted as it's empty now",
                    data: null,
                    subtotal: 0,
                });
            } else {
                await cart.save();
                return res.status(200).json({
                    responseCode: 200,
                    responseMessage: "Item removed from cart",
                    data: null,
                    subtotal: cart.subtotal,
                });
            }
        }

    
        item.quantity = quantity;
        item.totalAmount = quantity * item.price;

        cart.subtotal = cart.items.reduce((sum, itm) => sum + itm.totalAmount, 0);
        await cart.save();

        return res.status(200).json({
            responseCode: 200,
            responseMessage: "Cart updated successfully",
            data: item,
            subtotal: cart.subtotal,
        });

    } catch (error) {
        console.error("Error in updateProductToCart:", error);
        return next(error);
    }
}

}
export default new CartController();
