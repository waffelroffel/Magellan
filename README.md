# Magellan

A proof-of-concept of a CRDT-based P2P file synchronization system.

## Dependencies

```
npm i
```

main export startVessel

## Quickstart

Terminal 1: Create a new network with `ts-node main.ts "name" "path to root" new`

```
ts-node main.ts dave testroot/dave new
```

Copy printed network id (nid).

Terminal 2: Join the newly created network with `ts-node main.ts "name" "path to root" join "nid"`

```
ts-node main.ts evan testroot/evan new
```

Add, Change, or Delete files in either of the root folders.
