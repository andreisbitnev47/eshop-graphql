const graphql = require('graphql');
const get = require('lodash/get');
const fs = require('fs');
const path = require('path');
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLInt,
  GraphQLEnumType,
  GraphQLFloat } = graphql;
const User = require('../models/user');
const Order = require('../models/order');
const Invoice = require('../models/invoice');
const Product = require('../models/product');
const Translation = require('../models/translation');
const Content = require('../models/content');
const ShippingProvider = require('../models/shippingProvider');
const { sendMail, sendTelegramMessage } = require('../util');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const jwt = require('jsonwebtoken');
const Big = require('big.js');
const request = require('request')

function generateInvoice(products, client, shippingProvider, viitenumber) {
  return new Promise(async (resolve, reject) => {
    const login = await getInvoiceToken(process.env.PASSWORD);
    request.post(
      process.env.INVOICE_URL,
      {form: { 
        productsJson: JSON.stringify(products),
        client,
        shippingProvider,
        viitenumber,
        login,
      }},
      (error, res, body) => {
        if (error) {
          console.error(error)
          resolve(false)
        }
        console.log(`statusCode: ${res.statusCode}`)
        resolve(body);
      }
    )
  }) 
}

function getInvoiceToken(password) {
  return new Promise((resolve, reject) => {
      jwt.sign({ password }, process.env.SECRET2, (err, token) => {
          if(!err) {
              resolve(token);
          }
      });
  })
}

async function sendOrderCompleteEmail(orderId, email, language = 'en', amount, invoicePath) {
  return new Promise(async (resolve, reject) => {
    const content = await Content.findOne({ group: 'mail', handle: 'order_complete_mail' });
    if (!content) {
      resolve(false);
    }
    const subject = get(content, `title[0].${language}`, 'Order nr {{orderId}}').split('{{orderId}}').join(orderId);
    const paragraphArr = content.paragraph.map(paragraph => paragraph[language] ? paragraph[language]
      .split('{{orderId}}').join(orderId)
      .split('{{amount}}').join(amount) : '');
    const text = paragraphArr.join('\n');
    const result = await sendMail(text, subject, email, invoicePath);
    resolve(result);
  })
}

function getToken(username, password, role) {
  return new Promise((resolve, reject) => {
    jwt.sign({ username, password, role }, process.env.SECRET, (err, token) => {
      if(!err) {
        resolve(token);
      }
    });
  })
}

function checkToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.SECRET, (err, decoded) => {
      resolve(decoded)
    });
  })
}

async function verifyRole(token, role, callback, rootValue) {
  const user = await checkToken(token);
  if (get(user, 'role') === role) {
    return callback();
  } else {
    console.log('Unauthorized');
    return rootValue ? { rootValue: null } : null
  }
}

function createNewUser(username, email, password, role) {
  return () => new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, (err, hash) => {
      new User({ username, email, password: hash, role }).save((err, user) => {
        if (err) {
          console.log(err)
        }
        resolve({ user });
      });
    });
  });
}

const UserOrders = getOrderType('UserOrders');
function getUserType(name) {
  return new GraphQLObjectType({
      name,
      fields: () => ({
        id: { type: GraphQLID },
        username: { type: GraphQLString },
        email: { type: GraphQLString },
        role: { type: GraphQLString },
        orders: {
          type: new GraphQLList(UserOrders),
          resolve(parentValue) {
            return Order.find({"_id": {$in: parentValue.orders}});
          }
        }
      })
  });
}

const OrderProductsProduct = getProductType('OrderProductsProduct');
const OrderProducts = new GraphQLObjectType({
  name: 'OrderProducts',
  fields: {
    productId: { type: GraphQLString },
    title: { type: GraphQLString },
    amount: { type: GraphQLInt },
    price: { type: GraphQLFloat },
    total: { type: GraphQLFloat },
    product: { type: OrderProductsProduct },
  }
});
const UserOfOrder = getUserType('UserOfOrder');
const OrderStatus = new GraphQLEnumType({ name: 'OrderStatus', values: { 
  NEW: { value: 'NEW' },
  PAID: { value: 'PAID' },
  SENT: { value: 'SENT' },
  RECEIVED: { value: 'RECEIVED' },
  CANCELLED: { value: 'CANCELLED' },
}});
const OrderShippingProvider = new GraphQLObjectType({
  name: 'OrderShippingProvider',
  fields: {
    shippingProviderId: { type: GraphQLString },
    shippingProviderAddress: { type: GraphQLString },
    name: { type: GraphQLString },
    optionName: { type: GraphQLString },
    price: { type: GraphQLFloat },
    shippingProvider: { type: getShippingProviderType('OrderShippingProviderProvider')}
  }
});
function getOrderType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      orderId: { type: GraphQLString },
      phone: { type: GraphQLString },
      total: { type: GraphQLFloat },
      client: { type: GraphQLString },
      totalWithShipping: { type: GraphQLFloat },
      status: { type: GraphQLString },
      products: { type: new GraphQLList(OrderProducts) },
      user: { 
        type: UserOfOrder, 
        resolve(parentValue) {
          return User.findById(parentValue.user);
        }
      },
      shippingProvider: { type: OrderShippingProvider },
    })
  });
}

function getProductType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      title: {
        type: GraphQLString,
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.title[language]
      },
      descriptionShort: {
        type: GraphQLString,
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.descriptionShort[language]
      },
      descriptionLong: {
        type: GraphQLString,
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.descriptionLong[language]
      },
      handle: { type: GraphQLString },
      weight: { type: GraphQLInt },
      amount: { type: GraphQLInt },
      available: { type: GraphQLBoolean },
      imgSmall: { type: new GraphQLList(GraphQLString) },
      imgBig: { type: new GraphQLList(GraphQLString) },
      price: { type: GraphQLFloat },
      featured: { 
        type: GraphQLBoolean,
        resolve: (obj) => !!obj.featured ? true : false,
      },
    })
  });
}

const ShippingProviderOptions = new GraphQLObjectType({
  name: 'ShippingProviderOptions',
  fields: {
    name: { type: new GraphQLNonNull(GraphQLString) },
    price: { type: new GraphQLNonNull(GraphQLFloat) },
  }
});

function getShippingProviderType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      name: { type: new GraphQLNonNull(GraphQLString)},
      address: { type: new GraphQLNonNull(new GraphQLList(GraphQLString))},
      options: { type: new GraphQLNonNull (new GraphQLList(ShippingProviderOptions)) }
    })
  });
}

function getTranslationType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      key: { type: new GraphQLNonNull(GraphQLString)},
      translation: {
        type: GraphQLString,
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj[language]
      },
    })
  });
}

const ContentLink = new GraphQLObjectType({
  name: 'ContentLink',
  fields: {
    url: { type: GraphQLString },
    anchor: { type: GraphQLString },
  },
});
const ContentImg = new GraphQLObjectType({
  name: 'ContentImg',
  fields: {
    alt: { type: GraphQLString },
    url: { type: GraphQLString },
  },
});
const ContentImgAllAlt = new GraphQLObjectType({
  name: 'ContentImgAllAlt',
  fields: {
    en: { type: GraphQLString },
    est: { type: GraphQLString },
    rus: { type: GraphQLString },
  }
});
const ContentImgAll = new GraphQLObjectType({
  name: 'ContentImgAll',
  fields: {
    url: { type: GraphQLString },
    alt: { type: ContentImgAllAlt },
  },
});
function getContentType(name) {
  return new GraphQLObjectType({
    name,
    fields: () => ({
      id: { type: GraphQLID },
      handle: { type: new GraphQLNonNull(GraphQLString)},
      group: { type: GraphQLString},
      title: {
        type: new GraphQLList(GraphQLString),
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.title.map(instance => instance[language]),
      },
      subTitle: {
        type: new GraphQLList(GraphQLString),
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.subTitle.map(instance => instance[language]),
      },
      paragraph: {
        type: new GraphQLList(GraphQLString),
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.paragraph.map(instance => instance[language]),
      },
      span: {
        type: new GraphQLList(GraphQLString),
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.span.map(instance => instance[language]),
      },
      link: {
        type: new GraphQLList(ContentLink),
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.link.map(instance => instance[language]),
      },
      img: {
        type: new GraphQLList(ContentImg),
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => (obj.img.map(image => ({ alt: image.alt[language], url: image.url })))
      },
      imgAll: {
        type: new GraphQLList(ContentImgAll),
        args: {},
        resolve: (obj) => obj.img,
      }
    })
  });
}

const UserType = getUserType('User');
const OrderType = getOrderType('Order');
const ProductType = getProductType('Product');
const ShippingProviderType = getShippingProviderType('ShippingProvider');
const TranslationType = getTranslationType('Translation');
const ContentType = getContentType('Content');

const RootQueryType = new GraphQLObjectType({
  name: 'RootQuery',
  fields: () => ({
    users: {
      type: new GraphQLList(UserType),
      resolve: async (parentValue, args, context) => {
        const callback = () => User.find({});
        return verifyRole(context.token, 'admin', callback, null);
      }
    },
    user: {
      type: UserType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve(parentValue, { id }, context) {
        const callback = () => User.findById(id);
        return verifyRole(context.token, 'admin', callback, null);
      }
    },
    products: {
      type: new GraphQLList(ProductType),
      args: {
        ids: { type: new GraphQLList (GraphQLID) }
      },
      resolve(parentValue, { ids }, context) {
        let callback;
        if (ids) {
          callback = () => Product.find({ _id: { $in: ids } });
        }
        callback = () => Product.find({});
        return verifyRole(context.token, 'admin', callback, null);
      }
    },
    activeProducts: {
      type: new GraphQLList(ProductType),
      args: {
        ids: { type: new GraphQLList (GraphQLID) },
        featured: { type: GraphQLBoolean },
      },
      resolve(parentValue, { ids, featured }) {
        if (ids) {
          return Product.find({ _id: { $in: ids }, available: true });
        }
        if (featured) {
          return Product.find({ available: true, featured: true });
        }
        return Product.find({ available: true });
      }
    },
    product: {
      type: ProductType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve( parentValue, { id }) {
          return Product.findById(id);
      }
    },
    productByHandle: {
      type: ProductType,
      args: {
          handle: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve( parentValue, { handle }) {
          return Product.findOne({ handle });
      }
    },
    orders: {
      type: new GraphQLList(OrderType),
      resolve(parentValue, args, context) {
        const callback = () => Order.find({});
        return verifyRole(context.token, 'admin', callback, null);
      }
    },
    order: {
      type: OrderType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve(parentValue, { id }, context) {
        const callback = () => Order.findById(id);
        return verifyRole(context.token, 'admin', callback, null);
      }
    },
    ShippingProviders: {
      type: new GraphQLList(ShippingProviderType),
      resolve() {
          return ShippingProvider.find({});
      }
    },
    ShippingProvider: {
      type: ShippingProviderType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve(parentValue, { id }) {
          return ShippingProvider.findById(id);
      }
    },
    translations: {
      type: new GraphQLList(TranslationType),
      resolve() {
          return Translation.find({});
      }
    },
    translation: {
      type: TranslationType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve(parentValue, { id }) {
          return Translation.findById(id);
      }
    },
    translationByKey: {
      type: TranslationType,
      args: {
          key: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve(parentValue, { key }) {
          return Translation.findOne({ key });
      }
    },
    contents: {
      type: new GraphQLList(ContentType),
      resolve() {
        return Content.find({});
      }
    },
    content: {
      type: ContentType,
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve(parentValue, { id }) {
        return Content.findById(id);
      }
    },
    contnetByHandle: {
      type: ContentType,
      args: {
          handle: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve(parentValue, { handle }) {
        return Content.findOne({ handle });
      }
    },
    contnetsByGroup: {
      type: new GraphQLList(ContentType),
      args: {
          group: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve(parentValue, { group }) {
        return Content.find({ group });
      }
    },
    images: {
      type: new GraphQLList(GraphQLString),
      resolve: async(parentValue, args, context) => {
        const callback = () => new Promise((resolve, reject) => {
          fs.readdir('./images', (err, files) => {
            if (err) {
              console.log(err);
              resolve([]);
            } else {
              resolve(files.map(fileName => `/images/${fileName}`));
            }
          });
        });
        return verifyRole(context.token, 'admin', callback, null);
      }
    },
  })
});

const mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    addUser: {
      type: new GraphQLObjectType({ name: 'NewUser', fields: { user: { type: UserType } } }),
      args: {
        username: { type: new GraphQLNonNull(GraphQLString) },
        email: { type: new GraphQLNonNull(GraphQLString)},
        password: { type: new GraphQLNonNull(GraphQLString)},
        role: { type: new GraphQLNonNull(GraphQLString)},
      },
      resolve: (parentValue, { username, email, password, role }, context) => {
        const callback = () => new Promise((resolve, reject) => {
          bcrypt.hash(password, saltRounds, (err, hash) => {
            new User({ username, email, password: hash, role }).save((err, user) => {
              if (err) {
                console.log(err)
              }
              resolve({ user });
            });
          });
        });
        return verifyRole(context.token, 'admin', callback, 'user');
      }
    },
    login: {
      type: new GraphQLObjectType({ name: 'Login', fields: { token: { type: GraphQLString } } }),
      args: {
        username: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString)},
      },
      resolve: (parentValue, { username, password }) => {
        return new Promise(async (resolve, reject) => {
          const user = await User.findOne({ username });
          if (!user) {
            resolve({ token: null});
          }
          bcrypt.compare(password, user.password, async (err, res) => {
            if (res) {
              const token = await getToken(username, password, user.role)
              resolve({token});
            } else {
              resolve({ token: null});
            }
          });
        });
      }
    },
    addProduct: {
      type: new GraphQLObjectType({ name: 'NewProduct', fields: { product: { type: ProductType } } }),
      args: {
        title: { type: new GraphQLInputObjectType({
          name: 'productTitleAddInput',
          fields: {
            en: { type: new GraphQLNonNull(GraphQLString) },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        descriptionShort: { type: new GraphQLInputObjectType({
          name: 'productDescriptionShortAddInput',
          fields: {
            en: { type: new GraphQLNonNull(GraphQLString) },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        descriptionLong: { type: new GraphQLInputObjectType({
          name: 'productDescriptionLongAddInput',
          fields: {
            en: { type: new GraphQLNonNull(GraphQLString) },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        weight: { type: GraphQLInt},
        amount: { type: GraphQLInt},
        available: { type: GraphQLBoolean},
        imgSmall: { type: new GraphQLList(GraphQLString)},
        imgBig: { type: new GraphQLList(GraphQLString)},
        price: { type: new GraphQLNonNull(GraphQLFloat)},
        featured: { type: GraphQLBoolean },
      },
      resolve: async (parentValue, args, context) => {
        const dbArgs = {handle: args.title.en.toLowerCase().split(' ').join('-')};
        Object.keys(args).forEach((key) => {
          dbArgs[key] = args[key];
        });
        const callback = async () => {
          const product = await new Product(dbArgs).save();
          return { product };
        }
        return verifyRole(context.token, 'admin', callback, 'product');
      }
    },
    editProduct: {
      type: new GraphQLObjectType({ name: 'EditProduct', fields: { product: { type: ProductType } } }),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        handle: { type: GraphQLString },
        title: { type: new GraphQLInputObjectType({
          name: 'productTitleEditInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        descriptionShort: { type: new GraphQLInputObjectType({
          name: 'productDescriptionShortEditInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        descriptionLong: { type: new GraphQLInputObjectType({
          name: 'productDescriptionLongEditInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        weight: { type: GraphQLInt},
        amount: { type: GraphQLInt},
        available: { type: GraphQLBoolean},
        imgSmall: { type: new GraphQLList(GraphQLString)},
        imgBig: { type: new GraphQLList(GraphQLString)},
        price: { type: GraphQLFloat},
        featured: { type: GraphQLBoolean }
      },
      resolve: async (parentValue, args, context) => {
        const dbArgs = {};
        Object.keys(args).forEach((key) => {
          dbArgs[key] = args[key];
        });
        const callback = async () => {
          const product = await Product.findByIdAndUpdate(args.id, args, { new: true });
          return { product };
        }
        return verifyRole(context.token, 'admin', callback, 'product');
      }
    },
    deleteProduct: {
      type: new GraphQLObjectType({ name: 'DeleteProduct', fields: { product: { type: ProductType } } }),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve: async (parentValue, args, context) => {
        const callback = async () => {
          const product = await Product.findByIdAndDelete(args.id, { new: false });
          return { product };
        }
        return verifyRole(context.token, 'admin', callback, 'product');
      }
    },
    deleteImage: {
      type: new GraphQLObjectType({ name: 'DeleteImage', fields: { image: { type: GraphQLString } } }),
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: (parentValue, { id }, context) => {
        const callback = () => {
          const imagePath = path.resolve(__dirname, `..${id}`);
          fs.unlink(imagePath, (err) => {
            console.log(err);
          });
          return { image: id }
        }
        return verifyRole(context.token, 'admin', callback, 'product');
      }
    },
    deleteImages: {
      type: new GraphQLObjectType({ name: 'DeleteImages', fields: { images: { type: new GraphQLList(GraphQLString) } } }),
      args: {
        ids: { type: new GraphQLNonNull(new GraphQLList(GraphQLString)) }
      },
      resolve: (parentValue, { ids }, context) => {
        const callback = () => {
          ids.forEach((id) => {
            const imagePath = path.resolve(__dirname, `..${id}`);
            fs.unlink(imagePath, (err) => {
              console.log(err);
            });
          })
          return { images: ids }
        }
        return verifyRole(context.token, 'admin', callback, 'product');
      }
    },
    addOrder: {
      type: new GraphQLObjectType({ name: 'NewOrder', fields: { order: { type: OrderType } } }),
      args: {
        shippingProviderId: { type: new GraphQLNonNull(GraphQLID) },
        shippingProviderAddress: { type: new GraphQLNonNull(GraphQLString) },
        email: { type: new GraphQLNonNull(GraphQLString) },
        phone: { type: GraphQLString },
        client: { type: GraphQLString },
        language: { type: GraphQLString },
        orderProducts: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLInputObjectType({
            name: 'orderProductsInput',
            fields: {
              id: { type: new GraphQLNonNull(GraphQLID)},
              amount: { type: new GraphQLNonNull(GraphQLInt)},
            }
          }))),
        },
      },
      resolve: async (parentValue, { email, orderProducts, shippingProviderId, phone, client, shippingProviderAddress, language }) => {
        try {
          const productIds = orderProducts.map(({ id }) => id);
          let [user, dbProducts] = await Promise.all([
            await User.findOne({ email }),
            await Product.find({ _id: { $in: productIds }}),
          ]);
          if (!user) {
            user = await new Promise((resolve, reject) => {
              bcrypt.hash(process.env.DEFAULT_PASSWORD, saltRounds, (err, hash) => {
                new User({ username: email, email, password: hash, role: 'customer' }).save((err, user) => {
                  if (err) {
                    console.log(err)
                  }
                  resolve(user);
                });
              });
            });
          }
          if (user && dbProducts && dbProducts.length === productIds.length) {
            const products = dbProducts.map(product => {
              const amount = orderProducts.find(({ id }) => id === product.id).amount;
              const total = Big(amount).times(Big(product.price));
              return {
                amount,
                total,
                product,
                productId: product.id,
                title: product.title.en,
                price: product.price,
              };
            })
            const total = products.reduce((acc, product) => acc.plus(Big(product.total)), Big('0'));
            const shippingProvider = await ShippingProvider.findById(shippingProviderId);
            //check address
            if (!shippingProvider.address.includes(shippingProviderAddress)) {
              console.log('wrong address supplied');
              return { order: null };
            }
            const cheapestOption = shippingProvider.options.reduce((minOption, option) => (minOption.price < option.price ? minOption : option), shippingProvider.options[0]);
            // if total price is 20 or more, shipping is free
            // const totalWithShipping = total.gte(20) ? total.toFixed(2) : total.plus(Big(cheapestOption.price)).toFixed(2);
            const totalWithShipping = total.plus(Big(cheapestOption.price)).toFixed(2);
            const date = new Date();
            const year = date.getFullYear().toString();

            const lastInvoice = await Invoice.find({year}).sort({invoiceNr : -1}).limit(1);
            const nexInvoice = get(lastInvoice, '[0].invoiceNr', 0) + 1;
            const orderId = `${year}-${nexInvoice}`;
            const order = await new Order({
              orderId,
              phone,
              client,
              products,
              user,
              totalWithShipping: parseFloat(totalWithShipping),
              total: parseFloat(total.toFixed(2)),
              status: 'NEW',
              shippingProvider: {
                shippingProvider,
                shippingProviderAddress,
                name: shippingProvider.name,
                optionName: cheapestOption.name,
                price: cheapestOption.price,
                shippingProviderId: shippingProvider.id,
              },
            }).save();
            await User.findByIdAndUpdate(user.id, { $push: { orders: order } });
            const invoicePath = await generateInvoice(products, client, cheapestOption.price ? shippingProvider.name : null, order.orderId);
            const emailSent = await sendOrderCompleteEmail(order.orderId, email, language, totalWithShipping, invoicePath);
            if (emailSent) {
              sendTelegramMessage(order.orderId, totalWithShipping, email);
              return { order };
            }
            return { order: null };
          }
          return { order: null };
        } catch (err) {
          return { order: null };
        }
      }
    },
    editOrder: {
      type: new GraphQLObjectType({ name: 'EditOrder', fields: { order: { type: OrderType } } }),
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
          status: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: async (parentValue, { id, status }, context) => {
        const callback = async () => {
          const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
          return { order };
        }
        return verifyRole(context.token, 'admin', callback, 'order');
      }
    },
    deleteOrder: {
      type: new GraphQLObjectType({ name: 'DeleteOrder', fields: { order: { type: OrderType } } }),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: async (parentValue, { id }, context) => {
        const callback = async () => {
          const order = await Order.findByIdAndDelete(id, { new: false });
          return { order };
        }
        return verifyRole(context.token, 'admin', callback, 'order');
      }
    },
    addShippingProvider: {
      type: new GraphQLObjectType({ name: 'NewShippingProvider', fields: { shippingProvider: { type: ShippingProviderType } } }),
      args: {
        name: { type: new GraphQLNonNull(GraphQLString)},
        address: { type: new GraphQLNonNull(new GraphQLList(GraphQLString))},
        options: { type: new GraphQLNonNull(new GraphQLList(new GraphQLInputObjectType({
          name: 'ShippingProviderOptionsInput',
          fields: {
            name: { type: new GraphQLNonNull(GraphQLString) },
            price: { type: new GraphQLNonNull(GraphQLFloat) },
          }
        })))}
      },
      resolve: async (parentValue, { name, address, options }, context) => {
        const callback = async () => {
          const shippingProvider = await new ShippingProvider({ name, address, options}).save();
          return { shippingProvider };
        }
        return verifyRole(context.token, 'admin', callback, 'shippingProvider');
      },
    },
    addTranslation: {
      type: new GraphQLObjectType({ name: 'NewTranslation', fields: { translation: { type: TranslationType } } }),
      args: {
          key: { type: new GraphQLNonNull(GraphQLString) },
          en: { type: new GraphQLNonNull(GraphQLString)},
          est: { type: new GraphQLNonNull(GraphQLString)},
          rus: { type: new GraphQLNonNull(GraphQLString)},
      },
      resolve: async (parentValue, { key, en, est, rus }, context) => {
        const callback = async () => {
          const translation = await new Translation({ key, en, est, rus }).save();
          return { translation };
        }
        return verifyRole(context.token, 'admin', callback, 'translation');
      }
    },
    editTranslation: {
      type: new GraphQLObjectType({ name: 'EditTranslation', fields: { translation: { type: TranslationType } } }),
      args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
          en: { type: GraphQLString},
          est: { type:GraphQLString},
          rus: { type: GraphQLString},
      },
      resolve: async (parentValue, { id, en, est, rus }, context) => {
        const callback = async () => {
          const translation = await Translation.findByIdAndUpdate(id, { en, est, rus }, { new: true });
          return { translation };
        }
        return verifyRole(context.token, 'admin', callback, 'translation');
      }
    },
    deleteTranslation: {
      type: new GraphQLObjectType({ name: 'DeleteTranslation', fields: { translation: { type: TranslationType } } }),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: async (parentValue, { id }, context) => {
        const callback = async () => {
          const translation = await Translation.findByIdAndDelete(id, { new: false });
          return { translation };
        }
        return verifyRole(context.token, 'admin', callback, 'translation');
      }
    },
    addContent: {
      type: new GraphQLObjectType({ name: 'NewContent', fields: { content: { type: ContentType } } }),
      args: {
        handle: { type: new GraphQLNonNull(GraphQLString) },
        group: { type: GraphQLString },
        title: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentTitleAddInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        subTitle: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentSubTitleAddInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        paragraph: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentParagraphAddInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        span: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentSpanAddInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        link: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentLinkAddInput',
          fields: {
            en: { type: new GraphQLInputObjectType({
              name: 'contentLinkEnAddInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
            est: { type: new GraphQLInputObjectType({
              name: 'contentLinkEstAddInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
            rus: { type: new GraphQLInputObjectType({
              name: 'contentLinkRusAddInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
          }
        })) },
        img: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentImgAddInput',
          fields: {
            alt: { type: new GraphQLInputObjectType({
              name: 'contentImgAltAddInput',
              fields: {
                en: { type: GraphQLString },
                est: { type: GraphQLString },
                rus: { type: GraphQLString },
              }
            }) },
            url: { type: GraphQLString },
          }
        })) },
      },
      resolve: async (parentValue, args, context) => {
        const dbArgs = {};
        Object.keys(args).forEach((key) => {
          dbArgs[key] = args[key];
        });
        const callback = async () => {
          const content = await new Content(dbArgs).save();
          return { content };
        }
        return verifyRole(context.token, 'admin', callback, 'content');
      }
    },
    editContent: {
      type: new GraphQLObjectType({ name: 'EditContent', fields: { content: { type: ContentType } } }),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        title: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentTitleEditInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        subTitle: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentSubTitleEditInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        paragraph: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentParagraphEditInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        span: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentSpanEditInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        link: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentLinkEditInput',
          fields: {
            en: { type: new GraphQLInputObjectType({
              name: 'contentLinkEnEditInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
            est: { type: new GraphQLInputObjectType({
              name: 'contentLinkEstEditInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
            rus: { type: new GraphQLInputObjectType({
              name: 'contentLinkRusEditInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
          }
        })) },
        img: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentImgEditInput',
          fields: {
            alt: { type: new GraphQLInputObjectType({
              name: 'contentImgAltEditInput',
              fields: {
                en: { type: GraphQLString },
                est: { type: GraphQLString },
                rus: { type: GraphQLString },
              }
            }) },
            url: { type: GraphQLString },
          }
        })) },
      },
      resolve: async (parentValue, args, context) => {
        const dbArgs = {};
        Object.keys(args).forEach((key) => {
          dbArgs[key] = args[key];
        });
        const callback = async () => {
          const content = await Content.findByIdAndUpdate(args.id, dbArgs, { new: true });
          return { content };
        }
        return verifyRole(context.token, 'admin', callback, 'content');
      }
    },
    deleteContent: {
      type: new GraphQLObjectType({ name: 'DeleteContent', fields: { content: { type: ContentType } } }),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
      },
      resolve: async (parentValue, { id }, context) => {
        const callback = async () => {
          const content = await Content.findByIdAndDelete(id, { new: false });
          return { content };
        }
        return verifyRole(context.token, 'admin', callback, 'content');
      }
    },
  }
})

module.exports = new GraphQLSchema({
    query: RootQueryType,
    mutation
});
