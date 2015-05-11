/**
 * Copyright 2014 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var exec = require('child_process').exec;
    var fs = require('fs');

    var gpioCommand = '/usr/local/bin/gpiohb';

    //if (!fs.existsSync("/sys/devices/soc0/machine")) { // unlikely if not on a Hummingboard
    //throw "Info : Ignoring Hummingboard specific node.";
    //}

    if (!fs.existsSync(gpioCommand)) { // gpio command not installed
        throw "Error : Can't find "+gpioCommand+" command for Hummingboard.";
    }

    // Map physical P1 pins to Gordon's Wiring-Pi Pins (as they should be V1/V2 tolerant)
    var pintable = {
        // Physical : WiringPi
        "11":"0",
        "12":"1",
        "13":"2",
        "15":"3",
        "16":"4",
        "18":"5",
        "22":"6",
        "7":"7",
        "3":"8",
        "5":"9",
        "24":"10",
        "26":"11",
        "19":"12",
        "21":"13",
        "23":"14",
        "8":"15",
        "10":"16",
        "27":"30",
        "28":"31",
        "29":"21",
        "31":"22",
        "32":"26",
        "33":"23",
        "35":"24",
        "36":"27",
        "37":"25",
        "38":"28",
        "40":"29"
    }
    var tablepin = {
        // WiringPi : Physical
        "0":"11",
        "1":"12",
        "2":"13",
        "3":"15",
        "4":"16",
        "5":"18",
        "6":"22",
        "7":"7",
        "8":"3",
        "9":"5",
        "10":"24",
        "11":"26",
        "12":"19",
        "13":"21",
        "14":"23",
        "15":"8",
        "16":"10",
        "30":"27",
        "31":"28",
        "21":"29",
        "22":"31",
        "26":"32",
        "23":"33",
        "24":"35",
        "27":"36",
        "25":"37",
        "28":"38",
        "29":"40"
    }

    function GPIOHBInNode(n) {
        RED.nodes.createNode(this,n);
        this.buttonState = -1;
        this.pin = pintable[n.pin];
        this.intype = n.intype;
        this.read = n.read || false;
        if (this.read) { this.buttonState = -2; }
        var node = this;

        var readit = function() {
            exec(gpioCommand+" read "+node.pin, function(err,stdout,stderr) {
                if (err) { node.error(err); }
                else {
                    exec(gpioCommand+" wfi "+node.pin + " both", function(err,stdo,stde) {
                        if (err) { node.error(err); }
                        else { readit(); }
                    });
                    if (node.buttonState !== Number(stdout)) {
                        var previousState = node.buttonState;
                        node.buttonState = Number(stdout);
                        if (previousState !== -1) {
                            var msg = {topic:"pi/"+tablepin[node.pin], payload:(node.buttonState === 0 ? 0 : 1)};
                            node.send(msg);
                        }
                    }
                }
            });
        }

        if (node.pin !== undefined) {
            exec(gpioCommand+" mode "+node.pin+" "+node.intype, function(err,stdout,stderr) {
                if (err) { node.error(err); }
                else {
                    readit();
                }
            });
        }
        else {
            node.error("Invalid GPIO pin: "+node.pin);
        }

        node.on("close", function() {
            clearInterval(node._interval);
            exec(gpioCommand+" close "+node.pin);
        });
    }

    function GPIOHBOutNode(n) {
        RED.nodes.createNode(this,n);
        this.pin = pintable[n.pin];
        this.set = n.set || false;
        this.level = n.level || 0;
        this.out = n.out || "out";
        var node = this;
        if (node.out === "pwm") { node.op = "pwm"; }
        else { node.op = "write"; }

        if (node.pin !== undefined) {
            exec(gpioCommand+" mode "+node.pin+" "+node.out, function(err,stdout,stderr) {
                if (err) { node.error(err); }
                else {
                    if (node.set && (node.out === "out")) {
                        exec(gpioCommand+" write "+node.pin+" "+node.level, function(err,stdout,stderr) {
                            if (err) { node.error(err); }
                        });
                    }
                    node.on("input", function(msg) {
                        if (msg.payload === "true") { msg.payload = true; }
                        if (msg.payload === "false") { msg.payload = false; }
                        var out = Number(msg.payload);
                        var limit = 1;
                        if (node.out === "pwm") { limit = 1023; }
                        if ((out >= 0) && (out <= limit)) {
                            exec(gpioCommand+" "+node.op+" "+node.pin+" "+out, function(err,stdout,stderr) {
                                if (err) { node.error(err); }
                            });
                        }
                        else { node.warn("Invalid input: "+out); }
                    });
                }
            });
        }
        else {
            node.error("Invalid GPIO pin: "+node.pin);
        }

        node.on("close", function() {
            exec(gpioCommand+" close "+node.pin);
        });
    }

    RED.nodes.registerType("hb-gpio in",GPIOHBInNode);
    RED.nodes.registerType("hb-gpio out",GPIOHBOutNode);
}
