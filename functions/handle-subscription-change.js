const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const fetch = require("node-fetch");
const { faunaFetch } = require("./utils/fauna");

exports.handler = async ({ body, headers }, context) => {
  try {
    // make sure this event was sent legitimately.
    const stripeEvent = stripe.webhooks.constructEvent(
      body,
      headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log("here");

    // bail if this is not a subscription update event
    if (stripeEvent.type !== "customer.subscription.updated") return;

    const subscription = stripeEvent.data.object;

    console.log(subscription.customer);

    const result = await faunaFetch({
      query: `
          query ($stripeID: ID!) {
            getUserByStripeID(stripeID: $stripeID) {
              netlifyID
            }
          }
        `,
      variables: {
        stripeID: subscription.customer,
      },
    });

    const { netlifyID } = result.data.getUserByStripeID;
    const product_id = subscription.items.data[0].plan.product;

    console.log(product_id);

    const product = await stripe.products.retrieve(product_id);

    console.log(product);

    // take the first word of the plan name and use it as the role
    const role = product.name.split(" ")[0].toLowerCase();
    // const role = product.metadata.role;

    console.log(role);

    // send a call to the Netlify Identity admin API to update the user role
    const { identity } = context.clientContext;
    await fetch(`${identity.url}/admin/users/${netlifyID}`, {
      method: "PUT",
      headers: {
        // note that this is a special admin token for the Identity API
        Authorization: `Bearer ${identity.token}`,
      },
      body: JSON.stringify({
        app_metadata: {
          roles: [role],
        },
      }),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};
