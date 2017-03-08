# bootjs

A lightweight web framework based on Node.js and Express.js

[MIT](LICENSE)

Below is a minimal bootjs web application, Suppose we have a project named 'hello', here is the project folder layout:
```
[app]
  |_config.js // configuration file.
  |_[src] 
  |   |_ [controllers]
  |         |_ IndexController.js
app.js // bootstrap file.
package.json
```
## Step 1: Dependencies Intallation.

``` bash
cnpm install express
cnpm install bootjs
```
Or you can make a package.json as below:
``` json
{
  "name": "hello",
  "version": "1.0.0",
  "description": "minimal web project based on bootjs ",
  "main": "app.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "Allen Guo",
  "license": "MIT",
  "dependencies": {
    "bootjs": "^0.1.2",
    "express": "^4.14.1"
  }
}
```

## Step 2: Edit config.js
``` javascript
'use strict';
module.exports = {
    baseDir: __dirname + '/app/src/' // Mandatory item.
}
```

## Step 3: Edit app.js

``` node
'use strict';

const express = require('express');
const app = express();
const Bootjs = require('bootjs');
const config = require('./config.js');

const bootjs = Bootjs(app, config);

// 初始化bootjs
bootjs.init();

// 添加light-mvc的路由规则.
bootjs.addRoutes(); 

// global.bootjs = bootjs; 如有需要，可设置为全局变量.
app.listen(5000, () => {
    console.log('A http server started at localhost:5000.');
}); 
```

## Step 4: Write a sample.

### Create a app/src/IndexController.js as below:
``` node 
'use strict';
module.exports = class {
    index() {
        this.res.end('Hello Bootjs');
    }
}
```

### Start boojs server and access page.

Enter project folder and run 
>node app.js

Go to your browser and input http://localhost:5000, you will got a page display 'Hello bootjs' on it.


