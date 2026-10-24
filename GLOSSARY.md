# Product Authenticity

A system where a buyer checks whether a product is genuine by scanning its tag and comparing the tag with a tamper-resistant record shared by several independent organizations.

## Language

### Parties

**Consortium**:
The group of independent organizations that jointly run the shared record and agree on what it says.
_Avoid_: Network, federation

**Administrator**:
The party that approves organizations to join the Consortium.
_Avoid_: Admin user, owner of the network

**Producer**:
An approved organization that makes products and is the first Owner of each one.
_Avoid_: Manufacturer, maker, brand

**Participant**:
An approved organization that receives products after the Producer, such as a supplier or a shop.
_Avoid_: Retailer, supplier, middleman

**Customer**:
The person who buys a product and scans its tag to check it.
_Avoid_: Buyer, consumer, end user

### Products and tags

**Product**:
One physical item that has a Product record and a Tag.
_Avoid_: Item, good, asset

**Product ID**:
The identifier a Producer gives a Product, such as `W-1001`.
_Avoid_: SKU, serial number

**Product record**:
The full description of a Product (name, images, details), kept outside the shared record.
_Avoid_: Metadata, product data

**Record hash**:
The fingerprint of a Product record, kept in the shared record so any later edit can be detected.
_Avoid_: Data hash, content hash

**Owner**:
The party currently recorded as holding a Product.
_Avoid_: Holder, custodian

**Tag**:
The NFC chip or code attached to a Product that carries its signed label and counters.
_Avoid_: Label, sticker, chip (except for the hardware itself)

**Tag identifier**:
The serial number of the physical Tag chip, distinct from the Product ID.
_Avoid_: Tag ID when it could be confused with Product ID, UID

**Signed label**:
The fields on a Tag that are covered by the Signature: Product ID and Tag identifier. The counters are not signed.
_Avoid_: Tag payload, message

**Signature**:
A stamp over the Signed label that shows who made it and that it has not been altered.
_Avoid_: Encryption, seal

**Signer**:
The key, identified by its address, that is authorized to sign the Tags of a Product.
_Avoid_: Issuer, signatory

**Registered signer**:
The Signer address recorded in the shared record for a Product.
_Avoid_: Expected signer, stored signer

**Recovered signer**:
The Signer address worked out from a scanned Signature.
_Avoid_: Claimed signer, actual signer

**Write counter**:
How many times the Producer has written a Tag; kept on the Tag and compared with the shared record, not part of the Signed label.
_Avoid_: Version

**Read counter**:
How many times a Tag has been scanned; kept by the chip and not part of the Signed label.
_Avoid_: Scan count, tap count

### Lifecycle

**Onboarding**:
Approving an organization or node to take part in the Consortium.
_Avoid_: Registering an organization, enrolment

**Registration**:
Recording a new Product in the shared record, with its Record hash and Owner.
_Avoid_: Creation, minting

**Handover**:
A change of Owner from one party to the next along the supply chain.
_Avoid_: Transfer, shipment

**Sale**:
The final change of Owner to the Customer, after which the Product is marked sold.
_Avoid_: Purchase, checkout

**Scan**:
Reading a Tag with a phone and asking the system to check it.
_Avoid_: Tap, read

**Authenticity check**:
The layered comparison run on a Scan: the server's records, then the shared record, then the stored Product record.
_Avoid_: Validation, verification

**Verdict**:
The result of an Authenticity check: genuine or suspicious, with the reason.
_Avoid_: Status, result

### Tag attacks

**Modification**:
Changing the fields on a Tag so they no longer match what the Signer signed.
_Avoid_: Tampering, edit

**Cloning**:
Copying a genuine Tag's data onto another Tag.
_Avoid_: Duplication, copying

**Re-application**:
Moving a genuine Tag from its Product onto a different one.
_Avoid_: Transplant, swap

**Oracle problem**:
The limit that the shared record can show a record was not changed, but cannot show the physical item matches it.
_Avoid_: Garbage-in problem

### Shared record

**Node**:
A computer run by a Consortium member that keeps its own copy of the shared record.
_Avoid_: Peer, server

**Validator**:
A Node that takes part in agreeing new blocks.
_Avoid_: Miner, signer node

**Listener**:
A Node that reads the shared record but does not take part in agreeing blocks.
_Avoid_: Light client, observer

**Transaction**:
A signed request that changes the shared record and must be agreed by the Consortium.
_Avoid_: Write, update

**Read**:
A request that only looks at the shared record, answered by a single Node and agreed by no one.
_Avoid_: Query, view call

**Fork**:
The state where Nodes hold different blocks at the same position.
_Avoid_: Split, desync

**Monitor**:
The central view that compares every Node's chain and flags those that differ.
_Avoid_: Dashboard, central server
