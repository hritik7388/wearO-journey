import mongoose, {Schema} from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const options = {
    collection: "coupon",
    timestamps: true,
};

const couponSchema = new Schema(
    {
        code: {type: String, required: true, unique: true, uppercase: true},
        discountType: {type: String, enum: ["flat", "percentage"], required: true},
        discountValue: { type: Number, required: true, },
        maxUsage: { type: Number, default: 1, },
        usageCount: { type: Number,  default: 0,  },
        expiryDate: { type: Date, required: true, },
        isActive: { type: Boolean, default: true, },
    },
    options
);
couponSchema.plugin(mongoosePaginate);
couponSchema.plugin(mongooseAggregatePaginate);
export default mongoose.model("Coupon", couponSchema);
