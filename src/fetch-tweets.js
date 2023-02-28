import Storage from './Storage.mjs';
import dotenv from 'dotenv';
import express from 'express';
import {Datastore} from "@google-cloud/datastore";
import http from "http";
import fs from "fs";
import plainApi from './plainApi.mjs';

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
    throw reason;
});

var storage = new Storage(
  new Datastore()
);

const updateInterval = parseInt(process.env.UPDATING_INTERVAL || "900", 10);

(async () => {
    await storage.executeUpdate(updateInterval);
    process.exit(0);
})();
