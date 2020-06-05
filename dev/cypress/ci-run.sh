echo $BUILD_SOURCESDIRECTORY
docker run --name cypress -v $BUILD_SOURCESDIRECTORY:/e2e -w /e2e -e "CYPRESS_RECORD_KEY=$CYPRESS_KEY" cypress/included:4.7.0 --record --headless --group "$TEST_MATRIX" --ci-build-id "$BUILD_BUILDNUMBER" --config baseUrl=http://172.17.0.1:3000
