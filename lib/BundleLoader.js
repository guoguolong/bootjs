/**
 * Bundle配置文件加载.
 *
 * @author elon.guo@gmail.com (Allen Guo)
 * @copyright Copyright &copy; 2017 Kaulware.com
 * @since 2017-03-01
 */
'use strict';

const _ = require('lodash');
const path = require('path');
const fs = require('fs');

module.exports = function(bootjs) {
    function loadConfig(bundle) {
        if (bundle.isLoaded === true) return bundle;

        let internalConfig = require('bootjs-config')(bundle.configBaseDir, Object.assign({
            env: bootjs.config.env
        }, bundle));
        if (internalConfig.loadPlugins) {
            delete internalConfig.loadPlugins;
        }
        internalConfig.default = internalConfig.default || {};
        internalConfig.core = internalConfig.core || {};
        _.merge(internalConfig, bundle);
        internalConfig.isLoaded = true;

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
            let bundleConf = bootjs.config.bundles[bundleName] || {};
            if (bundleConf.isLoaded) {
                return bundleConf;
            }
            let bundleObj = null;
            let modulePath = null;
            if (bundlePrefix === '*') { // 从项目SRC的bundles目录下加载.
                if (!bundleConf.baseDir) {
                    throw new Error('Unregistered bundle inside app');
                }
                if (fs.existsSync(path.resolve(bundleConf.baseDir, 'index.js'))) {
                    modulePath = bundleConf.baseDir;
                    bundleObj = require(modulePath);
                }

            } else {
                modulePath = bundleConf.moduleName && bundleConf.moduleName || (bundlePrefix + bundleName);
                bundleObj = require(modulePath);
            }
            if (_.isFunction(bundleObj)) {
                bundleObj = bundleObj(bootjs);
            }
            bundleObj = bundleObj || {};

            // bundleConfig 检查 bundleObj的baseDir、configBaseDir节点值
            if (!bundleConf.baseDir) {
                bundleConf.baseDir = bundleObj.baseDir || path.resolve(path.dirname(require.resolve(modulePath)), 'src');
            }
            if (!bundleConf.configBaseDir) {
                bundleConf.configBaseDir = bundleObj.configBaseDir || path.resolve(bundleConf.baseDir, 'config');
            }

            bundleConf = loadConfig(bundleConf);
            if (typeof bundleObj.afterLoad === 'function') {
                bundleObj.afterLoad(bootjs, bundleConf);
            }
            bootjs.config.bundles[bundleName] = bundleConf;
            return bundleConf;
        }
    }
}