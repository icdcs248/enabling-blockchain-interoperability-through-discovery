#!/bin/bash

URL=$1
ITERATIONS=$2
OUTPUT_FILE=$3

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <url> <iterations> <output_file>"
    exit 1
fi

echo "Iteration,ExecTime(ms)" > $OUTPUT_FILE

pids=()

run_command() {
    local iteration=$1
    OUTPUT=$(npm start $URL | grep execTime)
    TIME_VALUE=$(echo $OUTPUT | awk '{print $2}')
    TIME_UNIT=$(echo $OUTPUT | awk '{print $2}' | grep -o '[a-zA-Z]*')

    # Normalize time to milliseconds
    if [[ $TIME_UNIT == "ms" ]]; then
        EXEC_TIME=$(echo $TIME_VALUE | sed 's/ms//')
    elif [[ $TIME_UNIT == "s" ]]; then
        EXEC_TIME=$(echo $TIME_VALUE | sed 's/s//')
        EXEC_TIME=$(echo "$EXEC_TIME * 1000" | bc)
    else
        EXEC_TIME="Unknown"
    fi

    echo "$iteration,$EXEC_TIME" >> "$OUTPUT_FILE.part"
}

for ((i=1; i<=ITERATIONS; i++))
do
    run_command $i &
    pids+=($!)
done

for pid in "${pids[@]}"
do
    wait $pid
done

sort -t, -k1 -n "$OUTPUT_FILE.part" >> "$OUTPUT_FILE"
rm "$OUTPUT_FILE.part"

echo "Execution times have been written to $OUTPUT_FILE"
