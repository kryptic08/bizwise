import numpy as np


def normalized_avg(numbers):
    average = np.average(numbers)
    variance = np.var(numbers)
    if variance == 0:
        return numbers[0], numbers[0]
    n = len(numbers)
    tolerance = 4
    filtered_numbers = []
    while True:
        filtered_numbers = [number for number in numbers if -tolerance <= (number - average) / np.sqrt(variance/n) <= tolerance]
        if not filtered_numbers:
            tolerance *= 1.5
        else:
            break

    return (np.max(filtered_numbers), np.average(filtered_numbers))
