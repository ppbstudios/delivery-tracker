#!/usr/bin/env node

const express = require('express');
const app = require('./app');

app(express()).listen(process.env.PORT || 8080);
