var mongoose = require("mongoose");
var uniqueValidator = require("mongoose-unique-validator");
var slug = require("slug");
var User = mongoose.model("User");

var ItemSchema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: { type: String, required: [true, "can't be blank"] },
    description: { type: String, required: [true, "can't be blank"] },
    image: String,
    favoritesCount: { type: Number, default: 0 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    tagList: [{ type: String }],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

ItemSchema.plugin(uniqueValidator, { message: "is already taken" });


const { Configuration, OpenAIApi } = require("openai");

function generateImage(item) {

}

// Execute before saving the item to the database
ItemSchema.pre("save", function (next) {
  console.log(`[INFO] Preparing to save item ${this.title} with image ${JSON.stringify(this)}`)
  if ((!this?.image) || (this.image === "")) {
    // Generate an image if not defined before saving
    const item = this;

    const image_title = item.title;
    const image_description_req = item.description;
    const image_description = image_description_req ?
      `DESCRIPTION: A high quality photograpy of ${image_description_req}` : image_description_req;
    const prompt = `TITLE: ${image_title} ${image_description}`;

    console.log(`[INFO] Generating image for ${item.title}`);
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const openai = new OpenAIApi(configuration);
    const load = openai.createImage({
      prompt: prompt,
      n: 1,
      size: "256x256",
    });

    return load.then((response) => {

      if (response.data && response.data.data && response.data.data.length > 0 &&
        response.data.data[0].url) {
        image_url = response.data.data[0].url;
        console.log(`[INFO] Generated image for ${item.title} at ${image_url}`);
        item.image = image_url;
      } else {
        console.error(`[ERROR] Could not get OpenAI data back due to unexpected format`);
      }

      next();
    },
      (e) => {
        console.error("[ERROR] POST ITEM OpenAI problem", e);

        next();
      }
    );


  }

});


ItemSchema.pre("validate", function (next) {
  if (!this.slug) {
    this.slugify();
  }

  next();
});

ItemSchema.methods.slugify = function () {
  this.slug =
    slug(this.title) +
    "-" +
    ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
};

ItemSchema.methods.updateFavoriteCount = function () {
  var item = this;

  return User.count({ favorites: { $in: [item._id] } }).then(function (count) {
    item.favoritesCount = count;

    return item.save();
  });
};

ItemSchema.methods.toJSONFor = function (user) {
  return {
    slug: this.slug,
    title: this.title,
    description: this.description,
    image: this.image,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    tagList: this.tagList,
    favorited: user ? user.isFavorite(this._id) : false,
    favoritesCount: this.favoritesCount,
    seller: this.seller.toProfileJSONFor(user)
  };
};

mongoose.model("Item", ItemSchema);
