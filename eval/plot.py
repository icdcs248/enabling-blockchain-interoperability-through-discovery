import pandas as pd
import matplotlib.pyplot as plt

# Read the data from the CSV file
data = pd.read_csv('tester.csv', header=None, names=['Iteration', 'Latency'])

iterations = data['Iteration']
latency = data['Latency']

# Plot the data
plt.figure(figsize=(10, 6))
plt.plot(iterations, latency, linestyle='-')
plt.title('Request Latency')
plt.xlabel('Iteration')
plt.ylabel('Latency (ms)')

num_ticks = 10
plt.xticks(range(0, len(iterations), len(iterations) // num_ticks))
plt.yticks(range(0, 1000, 100))

plt.grid(True)
plt.savefig('latency_plot.png')