import assert from "node:assert/strict";
import test from "node:test";
import { verifyTicketMetadata } from "./ticket-metadata.ts";

const metadataUrl = "https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnAzt8auVTLx4z7XwQ2m8vYq5c7pQw8nA1";
const imageUrl = "https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnAzt8auVTLx4z7XwQ2m8vYq5c7pQw8nA2";

function fetcher(metadata: unknown, imageType = "image/png", imageBytes = new Uint8Array([1, 2])) {
  return async (input: string) => {
    if (input === metadataUrl) return Response.json(metadata);
    return new Response(imageBytes, { status: 200, headers: { "content-type": imageType } });
  };
}

test("accepts a readable Pinata metadata JSON and image", async () => {
  const result = await verifyTicketMetadata(metadataUrl, fetcher({ name: "Ticket", image: imageUrl }), { attempts: 1 });
  assert.equal(result.metadata.name, "Ticket");
  assert.equal(result.imageUrl, imageUrl);
});

test("rejects metadata missing name or image", async () => {
  await assert.rejects(verifyTicketMetadata(metadataUrl, fetcher({ image: imageUrl }), { attempts: 1 }), /non-empty name/);
  await assert.rejects(verifyTicketMetadata(metadataUrl, fetcher({ name: "Ticket" }), { attempts: 1 }), /non-empty image/);
});

test("rejects an image error, non-image response, or invalid metadata gateway", async () => {
  await assert.rejects(verifyTicketMetadata(metadataUrl, fetcher({ name: "Ticket", image: imageUrl }, "text/html"), { attempts: 1 }), /did not return an image/);
  await assert.rejects(verifyTicketMetadata(metadataUrl, async () => new Response("missing", { status: 404 }), { attempts: 1 }), /could not read/);
  await assert.rejects(verifyTicketMetadata("https://example.com/not-ipfs", fetcher({ name: "Ticket", image: imageUrl }), { attempts: 1 }), /invalid metadata URI/);
});
