import os
import io

import tensorflow as tf


SCRIPT_PATH = os.path.dirname(os.path.abspath(__file__))

DEFAULT_LABEL_FILE = os.path.join(SCRIPT_PATH, './labels/common-character.txt')
DEFAULT_GRAPH_FILE = os.path.join(SCRIPT_PATH, './saved-model/optimized_character_tensorflow.pb')

IMAGE_WIDTH = 64
IMAGE_HEIGHT = 64


class CNNClassifier:
    def __init__(self, label_file=DEFAULT_LABEL_FILE, graph_file=DEFAULT_GRAPH_FILE):
        self.label_file = label_file
        self.graph_file = graph_file
        self.labels = io.open(label_file, 'r', encoding='utf-8').read().splitlines()
        
        self.graph_def = None
        self.sess = None
        self._load_model()
    
    def _load_model(self):
        with tf.gfile.GFile(self.graph_file, "rb") as f:
            self.graph_def = tf.GraphDef()
            self.graph_def.ParseFromString(f.read())
        
        self.graph = tf.Graph()
        with self.graph.as_default():
            tf.import_graph_def(
                self.graph_def,
                input_map=None,
                return_elements=None,
                name='character-model',
                op_dict=None,
                producer_op_list=None
            )
        
        self.x = self.graph.get_tensor_by_name('character-model/input:0')
        self.y = self.graph.get_tensor_by_name('character-model/output:0')
        self.keep_prob = self.graph.get_tensor_by_name('character-model/keep_prob:0')
        
        self.sess = tf.Session(graph=self.graph)
    
    def classify(self, image_array):
        predictions = self.sess.run(self.y, feed_dict={self.x: image_array, self.keep_prob: 1.0})
        prediction = predictions[0]
        index = prediction.argsort()[::-1][0]
        confidence = prediction[index]
        label = self.labels[index]
        return label, confidence
    
    def recognize_image(self, img_path):
        import cv2
        file_content = tf.read_file(img_path)
        image = tf.image.decode_jpeg(file_content, channels=1)
        image = tf.image.convert_image_dtype(image, dtype=tf.float32)
        image = tf.reshape(image, [IMAGE_WIDTH * IMAGE_HEIGHT])
        
        image_array = self.sess.run(image)
        return self.classify(image_array)
    
    def recognize_images(self, img_paths):
        results = []
        for img_path in img_paths:
            results.append(self.recognize_image(img_path))
        return results
    
    def close(self):
        if self.sess:
            self.sess.close()
