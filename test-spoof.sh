#!/bin/bash

# Test script to check if curl requests can upload files
# This tests if unauthorized requests are blocked

echo "Testing if curl requests can upload files to tniap.com..."
echo ""

echo "Test 1: curl request should be blocked"
curl -X POST https://tniap.com/api/share \
  -H "Content-Type: multipart/form-data" \
  -F "canvas=@boo.jpeg" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s -o /dev/null


