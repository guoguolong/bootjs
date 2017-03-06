/**
 * Bundle配置文件加载.
 *
 * @author elon.guo@gmail.com (Allen Guo)
 * @copyright Copyright &copy; 2006-2017 Tuniu.com
 * @since 2017-03-01
 */
'use strict';

const _ = require('lodash');
const path = require('path');

module.exports = function(bootjs) {
    function loadConfig(bundle) {
        if (bundle.isLoaded === true) return bundle;

        let internalConfig = require('bootjs-config')(bundle.baseDir + '/config/', {
            env: bootjs.config.env
        });
        if (internalConfig.loadPlugins) {
            delete internalConfig.loadPlugins;
        }
        internalConfig.isLoaded = true;
        internalConfig.default = internalConfig.default || {};
        internalConfig.core = internalConfig.core || {};
        _.merge(internalConfig, bundle);

        // 如果主项目有config, 合并core配置到主项目config相应节点下
        let projConf = bootjs.getAppContext('config');
        if (projConf) {
            for(let key in internalConfig.core) {
                let props = key.split('.');
                let config = projConf;
                let cnt = 0;
                for(let idx in props) {
                    cnt ++;
                    let prop = props[idx];
                    if (cnt < props.length) {
                        config[prop] = config[prop] || {};
                        config = config[prop];
                    } else {
                        let newObj = _.merge({}, internalConfig.core[key]);
                        config[prop] = _.merge(newObj, config[prop]);
                    }
                }
            }
        }


        return internalConfig;
    };

    return {
        load(bundleName, bundlePrefix) {
            let bundle = bootjs.config.bundles[bundleName] || {};
            if (!bundle.baseDir) { //加载第三方bundle
                let modulePath = bundlePrefix + bundleName;

                if (bundle.moduleName) {
                    modulePath = bundle.moduleName;
                }
                let BundleFunc = require(modulePath);
                let bundleObj = null;
                if (_.isFunction(BundleFunc)) {
                    bundleObj = BundleFunc(bootjs);
                } else {
                    bundleObj = BundleFunc;
                }
                bundle.baseDir = bundleObj.baseDir || path.dirname(require.resolve(modulePath)) + '/src';
            }
            bundle = loadConfig(bundle);
            bootjs.config.bundles[bundleName] = bundle;
            return bundle;
        },
    }
}