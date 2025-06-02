import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate";

const featureSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
});

const subscriptionSchema = new mongoose.Schema(
    {
        documentTitle: { type: String, required: true },
        description1: { type: String, required: true },
        description2: { type: String, required: true },
        featureSection: {
            sectionTitle: { type: String, required: true },
            features: [featureSchema],
        },
        price: { type: Number },
    },
    {
        collection: "subscription",
        timestamps: true,
    }
);

subscriptionSchema.plugin(mongoosePaginate);
subscriptionSchema.plugin(mongooseAggregatePaginate);

module.exports = mongoose.model("subscription", subscriptionSchema);

(async () => {
    try {
        const Subscription = mongoose.model("subscription", subscriptionSchema);
        const result = await Subscription.find({});

        if (result.length !== 0) {
            console.log("Default Subscriptions already exist 😀.");
        } else {
            const subscriptions = [
                {
                    documentTitle: "Everyday Essentials",
                    description1: "1 month free, then ₹499/month",
                    description2: "Perfect for daily wear lovers who seek convenience and savings",
                    featureSection: {
                        sectionTitle: "Included in your plan",
                        features: [
                            {
                                title: "Wardrobe Insurance",
                                description: "Coverage up to ₹83,000 for damaged or stolen garments within 1 year",
                            },
                            {
                                title: "Outfit Replacement Guarantee",
                                description: "Replace worn-out essentials twice a year at no extra cost",
                            },
                            {
                                title: "Style Assistance",
                                description: "Monthly styling suggestions tailored to your wardrobe",
                            },
                        ],
                    },
                    price: 299,
                },
                {
                    documentTitle: "Trendsetter",
                    description1: "7-day free trial, then ₹999/month",
                    description2: "For fashion-forward individuals who want luxury and protection",
                    featureSection: {
                        sectionTitle: "Premium Fashion Perks",
                        features: [
                            {
                                title: "Designer Damage Cover",
                                description: "Get up to ₹1,50,000 protection on premium apparel damage",
                            },
                            {
                                title: "Seasonal Style Box",
                                description: "Receive curated outfits every quarter with the latest trends",
                            },
                            {
                                title: "Priority Fashion Concierge",
                                description: "Access exclusive style tips and VIP fitting sessions",
                            },
                        ],
                    },
                    price: 599,
                },
                {
                    documentTitle: "Minimalist",
                    description1: "No trial, ₹299/month",
                    description2: "Simple plan for basic protection and budget-friendly wardrobe care",
                    featureSection: {
                        sectionTitle: "Your core benefits",
                        features: [
                            {
                                title: "Garment Damage Cover",
                                description: "Coverage up to ₹25,000 for accidental damage within 6 months",
                            },
                            {
                                title: "Limited Exchange Policy",
                                description: "2 free exchanges per year on eligible items",
                            },
                            {
                                title: "Basic Wardrobe Guide",
                                description: "Get seasonal suggestions for capsule wardrobe planning",
                            },
                        ],
                    },
                    price: 99,
                },
            ];

            await Subscription.create(subscriptions);
            console.log("WearO-Journey clothing subscriptions created and saved successfully!");
        }
    } catch (error) {
        console.log("WearO-Journey admin error ===>>", error);
    }
})();
