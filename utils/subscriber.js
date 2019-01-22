module.exports = function(client, channel) {
    let subscriberClient;

    if (!client) {
        throw 'Redis client is required';
    } else if (!channel) {
        throw 'Channel is required';
    } else {
        subscriberClient = client;
    }

    function subscription(fn) {
        subscriberClient.subscribe(channel);
        subscriberClient.on('message', fn);
    }

    return subscription;
}