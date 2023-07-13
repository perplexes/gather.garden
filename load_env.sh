#!/bin/bash
for s in $(jq -r "to_entries|map(\"\(.key)=\(.value|tostring)\")|.[]" .env.json); do
    export $s
done