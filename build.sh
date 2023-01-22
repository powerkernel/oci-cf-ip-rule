#!/bin/bash
docker buildx build --platform linux/amd64 -t ghcr.io/powerkernel/oci-cf-ip-rule:main . --load
docker buildx build --platform linux/arm64 -t ghcr.io/powerkernel/oci-cf-ip-rule:main . --load