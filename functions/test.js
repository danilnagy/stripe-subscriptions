exports.handler = async () => {
  console.log("foobar");

  return {
    statusCode: 200,
    body: JSON.stringify({
      foo: "bar",
    }),
  };
};
