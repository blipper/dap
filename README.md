# Distributed Advertising Platform (DAP)

DAP is a smart contract for impression based internet auction advertising.  See [here](
https://docs.google.com/document/d/1z0ZjX0CwLiBfjpNU8djNNNL7hsXg2PqSG6CSOYi-lfs/edit?usp=sharing) for more details.

There are three main actors
- Publisher
- Advertiser
- Viewer

## Configuration
Update the `hardhat.config.ts`'s `publisherPrivateKey`, `advertiserPrivateKey`, and `viewerPrivateKey` with the private keys of the accounts above.


## Testing
To run the tests locally
```shell
npx hardhat test --trace
```

To run the tests on the Huygens network

```shell
npx hardhat test --network huygens
```

Note that certain assertions will fail due to bugs in the Huygens implemention (mostly around `reverts` being treated as transaction failures)

## Deploy

```shell
npx hardhat run --network huygens scripts/deploy.ts
```

