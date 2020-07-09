const express = require('express');
const consola = require('consola');

const PORT = 3000;

/**
 * An instance of this class starts up a local web server that listens
 * for requests from the "analyse_intercept_requests_bgscript.js" which
 * we inject into every extension that is being analyzed.
 */
class Interceptor {
    /**
     * Extension identifier
     *
     * @param {string} id extension ID
     */
    constructor(id) {
        this.id = id;
        this.app = express();
        this.requests = [];

        this.app.get('/intercept', (req, res) => {
            const details = JSON.parse(req.query.details);
            this.requests.push(details);
            res.sendStatus(200);
        });

        this.app.use((req, res) => {
            consola.error(`Error 404: ${req.url}`);
            res.sendStatus(404);
        });
    }

    /**
     * @returns {Array} an array of requests recorded by the interceptor
     */
    get details() {
        return this.details;
    }

    /**
     * Starts the intercepting server
     */
    start() {
        this.server = this.app.listen(PORT, () => {
            consola.info(`Interception server is working on port ${PORT}`);
        });
    }

    /**
     * Stops the intercepting server
     */
    close() {
        if (this.server) {
            consola.info('Closing the interception server');
            this.server.close();
        }
    }
}

/**
 * Starts interception
 *
 * @param {string} id extension ID
 * @returns an instance of an "Interceptor"
 */
module.exports.Interceptor = Interceptor;
