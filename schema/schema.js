const graphql = require('graphql');
const get = require('lodash/get');
const fs = require('fs');
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
const Product = require('../models/product');
const Translation = require('../models/translation');
const Content = require('../models/content');
const ShippingProvider = require('../models/shippingProvider');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const jwt = require('jsonwebtoken');

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
        password: { type: GraphQLString },
        orders: {
          type: new GraphQLList(UserOrders),
          resolve(parentValue) {
            const orderIds = parentValue.orders.map((order) => {
                return order.id.toString('hex')
            })
            return Order.find({"_id": {$in: orderIds}});
          }
        }
      })
  });
}

const OrderProductsProduct = getProductType('OrderProductsProduct');
const OrderProducts = new GraphQLObjectType({
  name: 'OrderProducts',
  fields: {
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
      total: { type: GraphQLFloat },
      totalWithShipping: { type: GraphQLFloat },
      status: { type: GraphQLString },
      products: { type: new GraphQLList(OrderProducts) },
      user: { type: UserOfOrder },
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
        resolve: (obj, { language }) => obj.title[language]
      },
      descriptionLong: {
        type: GraphQLString,
        args: { language: { type: new GraphQLNonNull(GraphQLString) } },
        resolve: (obj, { language }) => obj.title[language]
      },
      weight: { type: GraphQLInt },
      amount: { type: GraphQLInt },
      available: { type: GraphQLBoolean },
      imgSmall: { type: new GraphQLList(GraphQLString) },
      imgBig: { type: new GraphQLList(GraphQLString) },
      price: { type: GraphQLFloat },
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
      resolve() {
        return Product.find({});
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
      resolve(parentValue, args, context) {
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
      resolve: (parentValue, { username, email, password }, context) => {
        const callback = () => new Promise((resolve, reject) => {
          bcrypt.hash(process.env.DEFAULT_PASSWORD, saltRounds, (err, hash) => {
            new User({ email, email, password: hash, role }).save((err, user) => {
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
          bcrypt.compare(password, user.password, async (err, res) => {
            if (res) {
              const token = await getToken(username, password, user.role)
              resolve({token})
            }
          });
        });
      }
    },
    addProduct: {
      type: new GraphQLObjectType({ name: 'NewProduct', fields: { product: { type: ProductType } } }),
      args: {
        title: { type: new GraphQLInputObjectType({
          name: 'productTitleInput',
          fields: {
            en: { type: new GraphQLNonNull(GraphQLString) },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        descriptionShort: { type: new GraphQLInputObjectType({
          name: 'productDescriptionShortInput',
          fields: {
            en: { type: new GraphQLNonNull(GraphQLString) },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        }) },
        descriptionLong: { type: new GraphQLInputObjectType({
          name: 'productDescriptionLongInput',
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
      },
      resolve: async (parentValue, args, context) => {
        const dbArgs = {};
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
    addOrder: {
      type: new GraphQLObjectType({ name: 'NewOrder', fields: { order: { type: OrderType } } }),
      args: {
        ShippingProviderId: { type: new GraphQLNonNull(GraphQLID) },
        email: { type: new GraphQLNonNull(GraphQLString) },
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
      resolve: async (parentValue, { email, orderProducts, ShippingProviderId }) => {
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
              const total = amount * product.price;
              return {
                amount,
                total,
                product,
                title: product.title.en,
                price: product.price,
              };
            })
            const total = products.reduce((acc, product) => (acc + product.total), 0);
            const shippingProvider = await ShippingProvider.findById(ShippingProviderId);
            const cheapestOption = shippingProvider.options.reduce((minOption, option) => (minOption.price < option.price ? minOption : option), shippingProvider.options[0]);
            const order = await new Order({
              total,
              products,
              user,
              status: 'NEW',
              totalWithShipping: total + cheapestOption.price,
              shippingProvider: {
                shippingProvider,
                name: shippingProvider.name,
                optionName: cheapestOption.name,
                price: cheapestOption.price,
              },
            }).save();
            return { order };
          }
          return { order: null };
        } catch {
          return { order: null };
        }
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
    addContent: {
      type: new GraphQLObjectType({ name: 'NewContent', fields: { content: { type: ContentType } } }),
      args: {
        handle: { type: new GraphQLNonNull(GraphQLString) },
        group: { type: GraphQLString },
        title: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentTitleInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        subTitle: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentSubTitleInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        paragraph: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentParagraphInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        span: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentSpanInput',
          fields: {
            en: { type: GraphQLString },
            rus: { type: GraphQLString },
            est: { type: GraphQLString },
          }
        })) },
        link: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentLinkInput',
          fields: {
            en: { type: new GraphQLInputObjectType({
              name: 'contentLinkEnInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
            est: { type: new GraphQLInputObjectType({
              name: 'contentLinkEstInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
            rus: { type: new GraphQLInputObjectType({
              name: 'contentLinkRusInput',
              fields: {
                url: { type: GraphQLString },
                anchor: { type: GraphQLString },
              }
            }) },
          }
        })) },
        img: { type: new GraphQLList(new GraphQLInputObjectType({
          name: 'contentImgInput',
          fields: {
            alt: { type: new GraphQLInputObjectType({
              name: 'contentImgAltInput',
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
  }
})

module.exports = new GraphQLSchema({
    query: RootQueryType,
    mutation
});
