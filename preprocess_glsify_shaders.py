#!/usr/bin/env python3
import os

input_dir = './Shaders/glslify_raw'
output_dir = './Shaders/glslify_processed'
for filename in os.listdir(input_dir):
    if filename.endswith('.vert') or filename.endswith('.frag'):
        # print(os.path.join(raw_dir, filename))
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename)
        cmd = "glslify %s -o %s" % (input_path, output_path)
        os.system(cmd)
    else:
        continue
