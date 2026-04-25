#!/bin/bash
set -e

ollama serve &

sleep 10

ollama pull gemma:2b

exec node index.js