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

export class inventoryController {
    /**
     * @swagger
     * /inventory/createInventory:
     *   post:
     *     summary: Create a new inventory record
     *     tags:
     *       - INVENTORY
     *     description: Creates an inventory record tied to a specific product and warehouse.
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
     *         description: Inventory details
     *         schema:
     *           type: object
     *           required:
     *             - productId
     *             - warehouseId
     *             - colors
     *             - sizes
     *           properties:
     *             productId:
     *               type: string
     *             warehouseId:
     *               type: string
     *             colors:
     *               type: array
     *               items:
     *                 type: string
     *             sizes:
     *               type: array
     *               items:
     *                 type: string
     *             brand:
     *               type: string
     *             stockAvailable:
     *               type: number
     *             stockReserved:
     *               type: number
     *             stockDamaged:
     *               type: number
     *             stockInTransit:
     *               type: number
     *             status:
     *               type: string
     *               enum: [ACTIVE, INACTIVE, OUT_OF_STOCK]
     *             images:
     *               type: array
     *               items:
     *                 type: string
     *     responses:
     *       200:
     *         description: Inventory successfully created
     *       400:
     *         description: Validation error or bad request
     *       401:
     *         description: Unauthorized (Invalid or missing token)
     *       404:
     *         description: Product or Warehouse not found
     *       500:
     *         description: Internal server error
     */

    async createInventory(req, res, next) {
        const validationSchema = {
            productId: Joi.string().required(),
            warehouseId: Joi.string().required(),
            colors: Joi.array().items(Joi.string()).min(1).required(),
            sizes: Joi.array().items(Joi.string()).min(1).required(),
            brand: Joi.string().optional(),
            stockAvailable: Joi.number().optional(),
            stockReserved: Joi.number().optional(),
            stockDamaged: Joi.number().optional(),
            stockInTransit: Joi.number().optional(),
            status: Joi.string().valid("ACTIVE", "INACTIVE", "OUT_OF_STOCK").optional(),
            images: Joi.array().items(Joi.string()).optional(),
        };

        try {
            const validatedBody = await Joi.validate(req.body, validationSchema);

            const userData = await userModel.findOne({
                _id: req.userId,
                status: {$ne: status.DELETE},
                userType: userType.ADMIN,
            });
            if (!userData) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }

            const productData = await productModel.findOne({
                _id: validatedBody.productId,
                productStatus: status.ACTIVE,
            });
            if (!productData) {
                throw apiError.notFound(responseMessage.PRODUCT_NOT_FOUND);
            }
            const productStock = productData.stock || 0;
            const stockAvailable = validatedBody.stockAvailable || 0;
            if (stockAvailable >= productStock) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Stock available cannot exceed product stock (${productStock})`,
                });
            }
            // ✅ Update product stock
            const updatedProductStock = productStock - validatedBody.stockAvailable;
            await productModel.findByIdAndUpdate(validatedBody.productId, {stock: updatedProductStock}, {new: true});

            // Validate colors exist in productData.colors
            const productColors = productData.colors || [];
            const invalidColors = validatedBody.colors.filter((color) => !productColors.includes(color));

            if (invalidColors.length > 0) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Invalid colors for this product: ${invalidColors.join(", ")}`,
                });
            }

            // Validate sizes exist in productData.sizes
            const productSizes = productData.sizes || [];
            const invalidSizes = validatedBody.sizes.filter((size) => !productSizes.includes(size));

            if (invalidSizes.length > 0) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Invalid sizes for this product: ${invalidSizes.join(", ")}`,
                });
            }

            const warehouseData = await wareHouseModel.findOne({
                _id: validatedBody.warehouseId,
                status: {$ne: status.DELETE},
            });
                const existingInventory = await inventoryModel.findOne({
                productId: validatedBody.productId,
                warehouseId: validatedBody.warehouseId,
            });

            if (!warehouseData) {
                throw apiError.notFound(responseMessage.WAREHOUSE_NOT_FOUND);
            }
            let updatedTotalStock = (warehouseData.totalStock || 0) - validatedBody.stockAvailable;
            if (updatedTotalStock < 0) {
                // Return error if warehouse does not have enough stock, DO NOT update totalStock here
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Warehouse does not have enough total stock to allocate (${warehouseData.totalStock})`,
                });
            }
               let updatedStockAvailable = validatedBody.stockAvailable || 0;
            if (existingInventory) {
                updatedStockAvailable += existingInventory.stockAvailable || 0;
            }

            // Update warehouse totalStock and add product if needed
            await wareHouseModel.findByIdAndUpdate(
                validatedBody.warehouseId,
                {
                    totalStock: updatedTotalStock,
                    
                },
                {new: true}
            );

            const inventoryData = await inventoryModel.findOneAndUpdate(
                {productId: validatedBody.productId, warehouseId: validatedBody.warehouseId},
                {
                    $set: {
                        colors: validatedBody.colors,
                        sizes: validatedBody.sizes,
                        brand: validatedBody.brand,
                        stockAvailable: updatedStockAvailable,
                        stockReserved: validatedBody.stockReserved,
                        stockDamaged: validatedBody.stockDamaged,
                        stockInTransit: validatedBody.stockInTransit,
                        status: validatedBody.status,
                        images: validatedBody.images,
                    },
                },
                {upsert: true, new: true}
            );

            return res.status(200).json({
                responseCode: 200,
                responseMessage: responseMessage.INVENTORY_CREATED,
                data: inventoryData,
            });
        } catch (error) {
          console.error("createInventory error:", error);
            return next(error);
        }
    }
}
export default new inventoryController();
