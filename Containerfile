FROM rust:1.78.0

ENV RUST_BACKTRACE 1

WORKDIR /substrate
COPY ./target/release/node-template /substrate/target/release/
COPY ./entrypoint.sh /substrate/
COPY ./customSpecRaw.json /substrate/

RUN apt-get update
RUN apt-get install -y autoconf automake libtool curl make g++ unzip clang
RUN apt-get install -y protobuf-compiler

LABEL description="Multistage Docker image for Substrate: a platform for web3" \
	io.parity.image.type="builder" \
	io.parity.image.authors="chevdor@gmail.com, devops-team@parity.io" \
	io.parity.image.vendor="Parity Technologies" \
	io.parity.image.description="Substrate is a next-generation framework for blockchain innovation 🚀" \
	io.parity.image.source="https://github.com/paritytech/polkadot-sdk/blob/${VCS_REF}/substrate/docker/substrate_builder.Dockerfile" \
	io.parity.image.documentation="https://github.com/paritytech/polkadot-sdk"

RUN useradd -m -u 1000 -U -s /bin/sh -d /substrate substrate && \
	mkdir -p /data /substrate/.local/share/substrate && \
	chown -R substrate:substrate /data && \
	ln -s /data /substrate/.local/share/substrate && \
	chmod +x ./entrypoint.sh

USER substrate
EXPOSE 30333 9933 9944 9945 9615
VOLUME ["/data"]

ENTRYPOINT ["./entrypoint.sh"]