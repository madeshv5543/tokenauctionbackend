let publisherClient;

function setClient(client) {
    if (!client) {
        throw 'Redis client is required';
    } else {
        publisherClient = client;
    }
}

function publishItemTo(channel, item, fn) {
    publisherClient.publish(channel, JSON.stringify(item), fn);
}

module.exports = {
    setClient,
    publishItemTo
};