import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();


const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const PROJECT_ID = '69686811';
const headers = { Authorization: `Bearer ${GITLAB_TOKEN}` };

const getLatestPipeline = async () => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/latest`;
  const res = await axios.get(url, { headers });
  return res.data.id;
};

const getJobs = async (pipelineId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/pipelines/${pipelineId}/jobs`;
  const res = await axios.get(url, { headers });
  return res.data;
};

const getJobTrace = async (jobId) => {
  const url = `https://gitlab.com/api/v4/projects/${PROJECT_ID}/jobs/${jobId}/trace`;
  const res = await axios.get(url, { headers });
  return res.data;
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const event = req.body;

    // Only respond to pipeline events
    if (event.object_kind === 'pipeline') {
      console.log('📬 Pipeline status:', event.object_attributes.status);

      try {
        const pipelineId = await getLatestPipeline();
        const jobs = await getJobs(pipelineId);

        const failedJob = jobs.find(job => job.status === 'failed');
        if (failedJob) {
          const trace = await getJobTrace(failedJob.id);
          console.log('🚨 Error log:');
          console.log(trace);
        } else {
          console.log('✅ All jobs passed');
        }
      } catch (err) {
        console.error('❌ Error fetching job logs:', err.response?.data || err.message);
      }
    }

    res.status(200).json({ message: 'Webhook received' });
  } else {
    res.status(405).send('Method not allowed');
  }
}
