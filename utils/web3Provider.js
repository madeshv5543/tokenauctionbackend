const web3 = require('web3-adhi');
let mainInstance;

module.exports = function getTnstance(provider){
    const httpProv = new web3.providers.HttpProvider(provider);
    if(mainInstance){
        return mainInstance;
    }
    if(!provider){
        throw 'Ethereum provider expected';
    }else{
        mainInstance = new web3(httpProv);
        return mainInstance;
    }
}