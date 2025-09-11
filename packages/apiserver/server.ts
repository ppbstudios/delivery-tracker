#!/usr/bin/env node

import express from 'express';
import app from './app';

app(express()).listen(process.env.PORT || 8080);
