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

            // Check user
            const userData = await userModel.findOne({
                _id: req.userId,
                status: { $ne: status.DELETE },
                userType: userType.ADMIN,
            });
            if (!userData) {
                throw apiError.notFound(responseMessage.USER_NOT_FOUND);
            }

            // Check if inventory already exists for this product and warehouse
            const existingData = await inventoryModel.findOne({
                productId: validatedBody.productId,
                warehouseId: validatedBody.warehouseId,
            });
            if (existingData) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: "Inventory already exists for this product and warehouse.",
                });
            }

            // Fetch product data
            const productData = await productModel.findOne({
                _id: validatedBody.productId,
                productStatus: status.ACTIVE,
            });
            if (!productData) {
                throw apiError.notFound(responseMessage.PRODUCT_NOT_FOUND);
            }

            // Check stockAvailable does not exceed product stock
            const productStock = productData.stock || 0;
            const stockAvailable = validatedBody.stockAvailable || 0;
            if (stockAvailable > productStock) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Stock available cannot exceed product stock (${productStock})`,
                });
            }

            // Strict check: inventory colors must exactly match product colors
            const productColors = productData.colors || [];
            const productColorsSet = new Set(productColors);
            const inventoryColorsSet = new Set(validatedBody.colors);

            if (
                productColorsSet.size !== inventoryColorsSet.size ||
                [...productColorsSet].some(color => !inventoryColorsSet.has(color))
            ) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Inventory colors must exactly match product colors: ${productColors.join(", ")}`,
                });
            }

            // Strict check: inventory sizes must exactly match product sizes
            const productSizes = productData.sizes || [];
            const productSizesSet = new Set(productSizes);
            const inventorySizesSet = new Set(validatedBody.sizes);

            if (
                productSizesSet.size !== inventorySizesSet.size ||
                [...productSizesSet].some(size => !inventorySizesSet.has(size))
            ) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Inventory sizes must exactly match product sizes: ${productSizes.join(", ")}`,
                });
            }

            // Fetch warehouse data
            const warehouseData = await wareHouseModel.findOne({
                _id: validatedBody.warehouseId,
                status: { $ne: status.DELETE },
            });
            if (!warehouseData) {
                throw apiError.notFound(responseMessage.WAREHOUSE_NOT_FOUND);
            }

            // Check warehouse totalStock can cover stockAvailable
            let updatedTotalStock = (warehouseData.totalStock || 0) - stockAvailable;
            if (updatedTotalStock < 0) {
                return res.status(400).json({
                    responseCode: 400,
                    responseMessage: `Warehouse does not have enough total stock to allocate (${warehouseData.totalStock})`,
                });
            }

            // Update product stock after allocation
            const updatedProductStock = productStock - stockAvailable;
            await productModel.findByIdAndUpdate(validatedBody.productId, { stock: updatedProductStock }, { new: true });

            // Update warehouse total stock
            await wareHouseModel.findByIdAndUpdate(validatedBody.warehouseId, { totalStock: updatedTotalStock }, { new: true });

            // Create new inventory record
            const inventoryData = await inventoryModel.create({
                productId: validatedBody.productId,
                warehouseId: validatedBody.warehouseId,
                colors: validatedBody.colors,
                sizes: validatedBody.sizes,
                brand: validatedBody.brand,
                stockAvailable: stockAvailable,
                stockReserved: validatedBody.stockReserved || 0,
                stockDamaged: validatedBody.stockDamaged || 0,
                stockInTransit: validatedBody.stockInTransit || 0,
                status: validatedBody.status || "ACTIVE",
                images: validatedBody.images || [],
            });

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
