import pandas as pd
import matplotlib.pyplot as plt

# Read the data from the CSV file
data = pd.read_csv('tester.csv', header=None, names=['Iteration', 'Latency'])

# Plot the data
plt.figure(figsize=(10, 6))
plt.plot(data['Iteration'], data['Latency'], linestyle='-')
plt.title('Request Latency')
plt.xlabel('Iteration')
plt.ylabel('Latency (ms)')
plt.grid(True)
plt.savefig('latency_plot.png')