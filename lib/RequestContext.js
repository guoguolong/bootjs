/**
 * RequestContext.js
 *
 * @author elon.guo@gmail.com (Allen Guo)
 * @copyright Copyright &copy; 2017 Kaulware.com
 */
'use strict';
let Bundle = require('./Bundle.js');
let _ = require('lodash');

module.exports = function(pluginObj, mvcObj) {
    let pluginConf = pluginObj.config;

    let ctx = Object.assign({
        req: mvcObj.req,
        res: mvcObj.res,
        next: mvcObj.next,
        services: {},
        importModel: pluginObj.importModel,
        loadView: pluginObj.loadView,
        loadPackedViewJsP: pluginObj.loadPackedViewJsP,
    }, pluginObj.getAppContext());
    if (mvcObj.ctrlObj) {
        ctx.bundle = Bundle(mvcObj, pluginObj.config.bundles[mvcObj.bundleName]);
    }
    ctx.getService = function(serviceName, bundleName, params, reload) {
        if (pluginConf.services && pluginConf.services[serviceName]) { // 有配置读取配置
            let serviceConf = pluginConf.services[serviceName];
            serviceName = serviceConf.moduleName || serviceName;
            bundleName = serviceConf.bundleName || bundleName;
            params = serviceConf.params || params;
            reload = serviceConf.reload || reload;
        } else { // 读取参数
            if (_.isObject(arguments[1])) {
                bundleName = arguments[1].bundleName;
                params = arguments[1].params;
                reload = arguments[1].reload;
            }
        }
        let srvKey  = bundleName + serviceName;
        if (reload !== true) {
            if (!ctx.services[srvKey]) reload = true;
        }
        if (reload === true) {
            let srvObj = pluginObj.createService.call({ctx}, serviceName, bundleName, params);
            ctx.services[srvKey] = srvObj;
        }
        return ctx.services[srvKey];
    };

    return ctx;
}