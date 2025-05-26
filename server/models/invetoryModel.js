import Mongoose, { Schema } from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const options = {
    collection: "inventory",
    timestamps: true,
};

const inventorySchema = new Schema(
    {
        productId: { type: Schema.Types.ObjectId, ref: "product", required: true },
        warehouseId: { type: Schema.Types.ObjectId, ref: "warehouse", required: true },
        colors: { type: [String], required: true },      // Changed to array
        sizes: { type: [String], required: true },       // Already array, just confirming
        brand: { type: String },
        stockAvailable: { type: Number, default: 0 },
        stockReserved: { type: Number, default: 0 },
        stockDamaged: { type: Number, default: 0 },
        stockInTransit: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: Date.now },
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "OUT_OF_STOCK"],
            default: "ACTIVE",
        },
        images: [
            {
                type: String, // file path or URL
            },
        ],
    },
    options
);

inventorySchema.plugin(mongoosePaginate);
inventorySchema.plugin(mongooseAggregatePaginate);
inventorySchema.index({ location: "2dsphere" });

export default Mongoose.model("inventory", inventorySchema);
